import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { CalendarEventDto, CalendarMonthDayDto, ReservationDto } from "../../types";
import { dateKeysInRange, warsawDateKey, warsawDayBounds } from "../calendar/warsaw-time";

export class CalendarServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = "CalendarServiceError";
  }
}

const EVENT_SELECT = "id, first_name, last_name, license_plate, planned_check_in, planned_check_out, status";

type CalendarReservation = Pick<
  ReservationDto,
  "id" | "first_name" | "last_name" | "license_plate" | "planned_check_in" | "planned_check_out" | "status"
>;

export function toCalendarEvent(row: CalendarReservation, kind: CalendarEventDto["kind"]): CalendarEventDto {
  return {
    kind,
    at: kind === "arrival" ? row.planned_check_in : row.planned_check_out,
    reservationId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    licensePlate: row.license_plate,
    status: row.status as CalendarEventDto["status"],
  };
}

export function buildMonthCounts(reservations: CalendarReservation[], from: string, to: string): CalendarMonthDayDto[] {
  return dateKeysInRange(from, to).map((date) => {
    const arrivals = reservations.filter((row) => warsawDateKey(new Date(row.planned_check_in)) === date).length;
    const departures = reservations.filter((row) => warsawDateKey(new Date(row.planned_check_out)) === date).length;
    const occupancy = reservations.filter((row) => {
      const { start, end } = warsawDayBounds(date);
      return (
        Date.parse(row.planned_check_in) < Date.parse(end) && Date.parse(row.planned_check_out) > Date.parse(start)
      );
    }).length;
    return { date, arrivals, departures, occupancy };
  });
}

export class CalendarService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listEvents(from: string, to: string): Promise<CalendarEventDto[]> {
    const [arrivalsResult, departuresResult] = await Promise.all([
      this.supabase
        .from("reservations")
        .select(EVENT_SELECT)
        .in("status", ["confirmed", "in_progress"])
        .gte("planned_check_in", from)
        .lt("planned_check_in", to)
        .order("planned_check_in", { ascending: true }),
      this.supabase
        .from("reservations")
        .select(EVENT_SELECT)
        .in("status", ["confirmed", "in_progress"])
        .gte("planned_check_out", from)
        .lt("planned_check_out", to)
        .order("planned_check_out", { ascending: true }),
    ]);

    if (arrivalsResult.error) throw new CalendarServiceError(`Arrivals: ${arrivalsResult.error.message}`);
    if (departuresResult.error) throw new CalendarServiceError(`Departures: ${departuresResult.error.message}`);

    const arrivals = (arrivalsResult.data ?? []) as CalendarReservation[];
    const departures = (departuresResult.data ?? []) as CalendarReservation[];

    return [
      ...arrivals.map((row) => toCalendarEvent(row, "arrival")),
      ...departures.map((row) => toCalendarEvent(row, "departure")),
    ].sort((a, b) => a.at.localeCompare(b.at));
  }

  async listMonthCounts(from: string, to: string): Promise<CalendarMonthDayDto[]> {
    const { data, error } = await this.supabase
      .from("reservations")
      .select(EVENT_SELECT)
      .in("status", ["confirmed", "in_progress"])
      .or(
        `and(planned_check_in.lt.${to},planned_check_out.gt.${from}),and(planned_check_out.gte.${from},planned_check_out.lt.${to})`
      )
      .order("planned_check_in", { ascending: true });

    if (error) throw new CalendarServiceError(`Month counts: ${error.message}`);
    return buildMonthCounts((data ?? []) as CalendarReservation[], from, to);
  }
}
