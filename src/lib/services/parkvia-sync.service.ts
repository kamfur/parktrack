import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import { addUtcDays, warsawDateKey, warsawDayBounds } from "../calendar/warsaw-time";
import {
  PARKVIA_SOURCE,
  decideSyncAction,
  type ExistingReservation,
  type ParkViaReservationFields,
} from "../parkvia/booking-mapper";
import { ParkCloudError, type ParkCloudEvent, type ParkCloudPort } from "../parkvia/parkcloud.port";
import { ReservationService } from "./reservation.service";

/** ParkCloud's rolling event history we read on the first run (30 days). */
export const BOOTSTRAP_EVENT_HOURS = 720;
/**
 * First run also scans future arrivals, so bookings made > 30 days ago are imported too. One call
 * per day at ParkCloud's 10 calls/min: ~12 min for the scan, once.
 */
export const BOOTSTRAP_ARRIVAL_DAYS = 120;

const EXISTING_COLUMNS =
  "id, status, last_name, first_name, email, phone, license_plate, planned_check_in, planned_check_out, passenger_count, flight_direction, total_cost";

export interface ParkViaSyncSummary {
  operators: string[];
  bookings: number;
  inserted: number;
  updated: number;
  cancelled: number;
  noShow: number;
  linked: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type AdminClient = SupabaseClient<Database>;

function emptySummary(): ParkViaSyncSummary {
  return {
    operators: [],
    bookings: 0,
    inserted: 0,
    updated: 0,
    cancelled: 0,
    noShow: 0,
    linked: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}

function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Pulls ParkVia bookings from ParkCloud and mirrors them into `reservations`.
 * Runs with the service-role client (no user session). The cursor (last ParkCloud event id) only
 * advances when ParkCloud itself answered; a booking our DB rejects is logged and skipped so one bad
 * booking cannot block the feed.
 */
export class ParkViaSyncService {
  private systemUserId: string | null = null;

  constructor(
    private readonly admin: AdminClient,
    private readonly parkCloud: ParkCloudPort,
    private readonly now: () => Date = () => new Date()
  ) {}

  async run(): Promise<ParkViaSyncSummary> {
    const summary = emptySummary();
    const operators = await this.parkCloud.getOperators();
    for (const operator of operators) {
      summary.operators.push(operator.Id);
      await this.syncOperator(operator.Id, summary);
    }
    return summary;
  }

  private async syncOperator(operatorId: string, summary: ParkViaSyncSummary): Promise<void> {
    const { data: state, error: stateError } = await this.admin
      .from("parkvia_sync_state")
      .select("last_event_id, last_run_at")
      .eq("operator_id", operatorId)
      .maybeSingle();
    if (stateError) throw new Error(`Failed to read ParkVia sync state: ${stateError.message}`);

    const startedAt = this.now();
    const failedBefore = summary.failed;
    let events: ParkCloudEvent[];
    const references: string[] = [];

    try {
      if (!state) {
        events = await this.parkCloud.getEventsByAge(operatorId, BOOTSTRAP_EVENT_HOURS);
        references.push(...(await this.futureArrivalReferences(operatorId)));
      } else if (state.last_event_id != null) {
        events = await this.parkCloud.getEventsSince(operatorId, state.last_event_id);
      } else {
        const sinceMs = state.last_run_at ? startedAt.getTime() - Date.parse(state.last_run_at) : 0;
        const hours = Math.min(BOOTSTRAP_EVENT_HOURS, Math.ceil(sinceMs / 3_600_000) + 2);
        events = await this.parkCloud.getEventsByAge(operatorId, hours);
      }
    } catch (error) {
      // A failed bootstrap leaves no state row, so the next run bootstraps again.
      if (state) await this.saveState(operatorId, state.last_event_id, startedAt, (error as Error).message);
      throw error;
    }

    const ordered = [...events].sort((a, b) => a.Id - b.Id);
    for (const event of ordered) references.push(event.BookingReference);
    const unique = [...new Set(references)];

    let aborted: Error | null = null;
    for (const reference of unique) {
      try {
        await this.syncBooking(operatorId, reference, summary);
      } catch (error) {
        if (error instanceof ParkCloudError && error.status !== 403 && error.status !== 404) {
          // ParkCloud outage / auth problem: stop and retry the whole window next run.
          aborted = error;
          break;
        }
        summary.failed += 1;
        summary.errors.push(`${reference}: ${(error as Error).message}`);
        // eslint-disable-next-line no-console
        console.error(`ParkVia sync: booking ${reference} failed:`, error);
      }
    }

    const maxEventId = ordered.length ? ordered[ordered.length - 1].Id : null;
    const nextCursor = aborted ? (state?.last_event_id ?? null) : (maxEventId ?? state?.last_event_id ?? null);
    const failures = summary.failed - failedBefore;
    const lastError = aborted?.message ?? (failures ? `${failures} booking(s) failed` : null);
    // A failed bootstrap leaves no state row, so the next run bootstraps again.
    if (aborted && !state) throw aborted;
    await this.saveState(operatorId, nextCursor, startedAt, lastError);
    if (aborted) throw aborted;
  }

  private async futureArrivalReferences(operatorId: string): Promise<string[]> {
    const today = warsawDateKey(this.now());
    const dateKeys = Array.from({ length: BOOTSTRAP_ARRIVAL_DAYS }, (_, i) => addUtcDays(today, i));
    const references: string[] = [];
    // Sequential: the client paces calls to the rate limit anyway.
    for (const key of dateKeys) references.push(...(await this.parkCloud.getArrivalReferences(operatorId, key)));
    return references;
  }

  private async syncBooking(operatorId: string, reference: string, summary: ParkViaSyncSummary): Promise<void> {
    summary.bookings += 1;
    const booking = await this.parkCloud.getBooking(operatorId, reference);

    let existing = await this.findImported(booking.Reference);
    if (!existing && booking.Status.toUpperCase() === "CONFIRMED") {
      existing = await this.linkManualDuplicate(booking.Reference, booking.Vehicle?.Registration, booking.ArrivalDate);
      if (existing) summary.linked += 1;
    }

    const action = decideSyncAction(booking, existing, this.now());
    switch (action.kind) {
      case "insert":
        if (await this.insert(booking.Reference, action.fields, action.notes)) summary.inserted += 1;
        else summary.skipped += 1;
        return;
      case "update":
        await this.update(action.id, action.changes);
        summary.updated += 1;
        return;
      case "status":
        // Through ReservationService so a garage/carport spot is released like a staff cancel.
        await new ReservationService(this.admin).updateReservation(action.id, { status: action.status });
        if (action.status === "cancelled") summary.cancelled += 1;
        else summary.noShow += 1;
        return;
      case "skip":
        summary.skipped += 1;
        return;
    }
  }

  private async findImported(reference: string): Promise<ExistingReservation | null> {
    const { data, error } = await this.admin
      .from("reservations")
      .select(EXISTING_COLUMNS)
      .eq("external_source", PARKVIA_SOURCE)
      .eq("external_reference", reference)
      .maybeSingle();
    if (error) throw new Error(`Failed to look up ParkVia booking: ${error.message}`);
    return data;
  }

  /**
   * Staff may have typed a ParkVia booking in by hand before the integration existed. Same plate,
   * same Warsaw arrival day, not linked to any channel yet, still confirmed → adopt it instead of
   * creating a duplicate. Ambiguous matches are left alone (a new reservation is imported).
   */
  private async linkManualDuplicate(
    reference: string,
    registration: string | null | undefined,
    arrivalDate: string
  ): Promise<ExistingReservation | null> {
    const plate = normalizePlate(registration);
    if (!plate) return null;
    const { start, end } = warsawDayBounds(arrivalDate.slice(0, 10));

    const { data, error } = await this.admin
      .from("reservations")
      .select(EXISTING_COLUMNS)
      .is("external_reference", null)
      .eq("status", "confirmed")
      .gte("planned_check_in", start)
      .lt("planned_check_in", end);
    if (error) throw new Error(`Failed to look up manual duplicates: ${error.message}`);

    const matches = (data ?? []).filter((row) => normalizePlate(row.license_plate) === plate);
    if (matches.length !== 1) return null;

    const { error: linkError } = await this.admin
      .from("reservations")
      .update({ source: "parkvia", external_source: PARKVIA_SOURCE, external_reference: reference, is_paid: true })
      .eq("id", matches[0].id);
    if (linkError) throw new Error(`Failed to link manual reservation: ${linkError.message}`);
    return matches[0];
  }

  /** Returns false when another run imported the same booking first (unique index). */
  private async insert(reference: string, fields: ParkViaReservationFields, notes: string): Promise<boolean> {
    const systemUserId = await this.getSystemUserId();
    const { error } = await this.admin.from("reservations").insert({
      ...fields,
      notes,
      source: "parkvia",
      external_source: PARKVIA_SOURCE,
      external_reference: reference,
      // Paid online on ParkVia.
      is_paid: true,
      created_by: systemUserId,
      last_modified_by: systemUserId,
    });
    if (error?.code === "23505") return false;
    if (error) throw new Error(`Failed to import ParkVia booking: ${error.message}`);
    return true;
  }

  private async update(id: string, changes: Partial<ParkViaReservationFields>): Promise<void> {
    const { planned_check_in, planned_check_out, ...rest } = changes;
    if (planned_check_in || planned_check_out) {
      // Dates go through ReservationService: it re-validates a covered spot's buffer.
      await new ReservationService(this.admin).updateReservation(id, { planned_check_in, planned_check_out });
    }
    if (Object.keys(rest).length) {
      const { error } = await this.admin.from("reservations").update(rest).eq("id", id);
      if (error) throw new Error(`Failed to update ParkVia booking: ${error.message}`);
    }
  }

  private async getSystemUserId(): Promise<string> {
    if (this.systemUserId) return this.systemUserId;
    const { data, error } = await this.admin.rpc("get_system_user");
    if (error || !data) throw new Error(`Failed to get system user: ${error?.message ?? "Unknown error"}`);
    this.systemUserId = data;
    return data;
  }

  private async saveState(
    operatorId: string,
    lastEventId: number | null,
    runAt: Date,
    lastError: string | null
  ): Promise<void> {
    const { error } = await this.admin.from("parkvia_sync_state").upsert({
      operator_id: operatorId,
      last_event_id: lastEventId,
      last_run_at: runAt.toISOString(),
      last_error: lastError,
      updated_at: runAt.toISOString(),
    });
    if (error) throw new Error(`Failed to save ParkVia sync state: ${error.message}`);
  }
}
