import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarageAssignmentDto, GarageOccupancyEntryDto, GarageSpotDto } from "../../types";

/** Minimum idle time required between one vehicle's departure and the next arrival on the same spot. */
export const GARAGE_BUFFER_MS = 10 * 60 * 60 * 1000;

export class GarageBufferViolationError extends Error {
  constructor(message = "Assignment would violate the minimum 10h buffer") {
    super(message);
    this.name = "GarageBufferViolationError";
  }
}

interface ReservationWindow {
  checkIn: Date;
  checkOut: Date;
}

/**
 * True when `candidate` and `existing` keep at least `GARAGE_BUFFER_MS` of idle
 * time between them, in whichever order they occur on the shared spot.
 */
export function respectsBuffer(candidate: ReservationWindow, existing: ReservationWindow): boolean {
  const candidateAfterExisting = candidate.checkIn.getTime() - existing.checkOut.getTime() >= GARAGE_BUFFER_MS;
  const existingAfterCandidate = existing.checkIn.getTime() - candidate.checkOut.getTime() >= GARAGE_BUFFER_MS;
  return candidateAfterExisting || existingAfterCandidate;
}

interface ActiveAssignmentRow {
  reservation_id: string;
  reservations: { planned_check_in: string; planned_check_out: string } | null;
}

interface ActiveOccupancyRow {
  id: string;
  garage_spot_id: string;
  garage_spots: { name: string } | null;
  reservation_id: string;
  reservations: { last_name: string; planned_check_in: string; planned_check_out: string } | null;
}

/**
 * Owns the 10h-buffer invariant. Auto-assign (at reservation creation) and manual
 * swap both go through `assign`, so the invariant can't be violated through either path.
 */
export class GarageAllocationService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async activeWindowsForSpot(
    garageSpotId: string,
    excludeReservationId?: string
  ): Promise<ReservationWindow[]> {
    let query = this.supabase
      .from("garage_assignments")
      .select("reservation_id, reservations!inner(planned_check_in, planned_check_out)")
      .eq("garage_spot_id", garageSpotId)
      .is("superseded_at", null);

    if (excludeReservationId) {
      query = query.neq("reservation_id", excludeReservationId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch active garage assignments: ${error.message}`);
    }

    return ((data ?? []) as unknown as ActiveAssignmentRow[]).flatMap((row) => {
      if (!row.reservations) return [];
      return [
        {
          checkIn: new Date(row.reservations.planned_check_in),
          checkOut: new Date(row.reservations.planned_check_out),
        },
      ];
    });
  }

  private async isSpotAvailableForWindow(garageSpotId: string, candidate: ReservationWindow): Promise<boolean> {
    const existingWindows = await this.activeWindowsForSpot(garageSpotId);
    return existingWindows.every((existing) => respectsBuffer(candidate, existing));
  }

  /**
   * First available garage/carport spot (is_available = true) whose active
   * assignments all keep the 10h buffer against the given window, or null.
   */
  async findAvailableSpot(plannedCheckIn: string, plannedCheckOut: string): Promise<GarageSpotDto | null> {
    const candidate: ReservationWindow = {
      checkIn: new Date(plannedCheckIn),
      checkOut: new Date(plannedCheckOut),
    };

    const { data: spots, error } = await this.supabase
      .from("garage_spots")
      .select("*")
      .eq("is_available", true)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch garage spots: ${error.message}`);
    }

    for (const spot of spots ?? []) {
      if (await this.isSpotAvailableForWindow(spot.id, candidate)) {
        return spot;
      }
    }

    return null;
  }

  /**
   * Inserts a new active assignment. The buffer check and insert happen
   * atomically inside the `assign_garage_spot` DB function, serialized per
   * `garageSpotId` by a Postgres advisory lock — closes the check-then-act
   * race a JS-side check-then-insert would otherwise have.
   */
  async assign(
    reservationId: string,
    garageSpotId: string,
    assignedBy: "system" | "staff"
  ): Promise<GarageAssignmentDto> {
    const { data, error } = await this.supabase.rpc("assign_garage_spot", {
      p_reservation_id: reservationId,
      p_garage_spot_id: garageSpotId,
      p_assigned_by: assignedBy,
    });

    if (error) {
      if (error.message.includes("GARAGE_BUFFER_VIOLATION")) {
        throw new GarageBufferViolationError();
      }
      throw new Error(`Failed to create garage assignment: ${error.message}`);
    }

    return data;
  }

  /**
   * Re-validates that `reservationId`'s current garage assignment (if any)
   * still respects the 10h buffer against a new `[checkIn, checkOut)` window
   * — call before persisting an edit to a garage reservation's planned dates.
   * No-op if the reservation has no active garage assignment.
   */
  async revalidateAssignment(reservationId: string, plannedCheckIn: string, plannedCheckOut: string): Promise<void> {
    const { data: activeAssignment, error } = await this.supabase
      .from("garage_assignments")
      .select("garage_spot_id")
      .eq("reservation_id", reservationId)
      .is("superseded_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch current garage assignment: ${error.message}`);
    }
    if (!activeAssignment) return;

    const candidate: ReservationWindow = { checkIn: new Date(plannedCheckIn), checkOut: new Date(plannedCheckOut) };
    const existingWindows = await this.activeWindowsForSpot(activeAssignment.garage_spot_id, reservationId);

    if (!existingWindows.every((existing) => respectsBuffer(candidate, existing))) {
      throw new GarageBufferViolationError(
        "These dates would violate the 10h buffer for the reservation's assigned garage spot"
      );
    }
  }

  /**
   * Supersedes the reservation's current active assignment (if any) and assigns
   * the new spot, re-validating the buffer for the new spot via `assign`.
   */
  async swap(reservationId: string, newGarageSpotId: string): Promise<GarageAssignmentDto> {
    const { data: current, error: currentError } = await this.supabase
      .from("garage_assignments")
      .select("id")
      .eq("reservation_id", reservationId)
      .is("superseded_at", null)
      .maybeSingle();

    if (currentError) {
      throw new Error(`Failed to fetch current garage assignment: ${currentError.message}`);
    }

    if (current) {
      const { error: supersedeError } = await this.supabase
        .from("garage_assignments")
        .update({ superseded_at: new Date().toISOString() })
        .eq("id", current.id);

      if (supersedeError) {
        throw new Error(`Failed to supersede prior garage assignment: ${supersedeError.message}`);
      }
    }

    return this.assign(reservationId, newGarageSpotId, "staff");
  }

  /** All currently-active assignments, denormalized for the occupancy view. */
  async listActiveAssignments(): Promise<GarageOccupancyEntryDto[]> {
    const { data, error } = await this.supabase
      .from("garage_assignments")
      .select(
        "id, garage_spot_id, garage_spots!inner(name), reservation_id, reservations!inner(last_name, planned_check_in, planned_check_out)"
      )
      .is("superseded_at", null)
      .order("garage_spot_id", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch garage occupancy: ${error.message}`);
    }

    return ((data ?? []) as unknown as ActiveOccupancyRow[]).flatMap((row) => {
      if (!row.garage_spots || !row.reservations) return [];
      return [
        {
          assignmentId: row.id,
          garageSpotId: row.garage_spot_id,
          garageSpotName: row.garage_spots.name,
          reservationId: row.reservation_id,
          lastName: row.reservations.last_name,
          plannedCheckIn: row.reservations.planned_check_in,
          plannedCheckOut: row.reservations.planned_check_out,
        },
      ];
    });
  }
}
