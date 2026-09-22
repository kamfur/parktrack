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

  private async activeWindowsForSpot(garageSpotId: string): Promise<ReservationWindow[]> {
    const { data, error } = await this.supabase
      .from("garage_assignments")
      .select("reservations!inner(planned_check_in, planned_check_out)")
      .eq("garage_spot_id", garageSpotId)
      .is("superseded_at", null);

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

  private async fetchReservationWindow(reservationId: string): Promise<ReservationWindow> {
    const { data, error } = await this.supabase
      .from("reservations")
      .select("planned_check_in, planned_check_out")
      .eq("id", reservationId)
      .single();

    if (error || !data) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    return { checkIn: new Date(data.planned_check_in), checkOut: new Date(data.planned_check_out) };
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
   * Inserts a new active assignment after re-validating the buffer (defends
   * against a race between the caller's check and this write).
   */
  async assign(
    reservationId: string,
    garageSpotId: string,
    assignedBy: "system" | "staff"
  ): Promise<GarageAssignmentDto> {
    const candidate = await this.fetchReservationWindow(reservationId);

    if (!(await this.isSpotAvailableForWindow(garageSpotId, candidate))) {
      throw new GarageBufferViolationError();
    }

    const { data, error } = await this.supabase
      .from("garage_assignments")
      .insert({ reservation_id: reservationId, garage_spot_id: garageSpotId, assigned_by: assignedBy })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create garage assignment: ${error.message}`);
    }

    return data;
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
