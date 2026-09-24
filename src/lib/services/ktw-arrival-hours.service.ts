import { createKatowiceBoardAdapter } from "../ktw/katowice-board.adapter";
import type { KtwArrivalsPort } from "../ktw/ktw-arrivals.port";
import { selectArrivalHours, type KtwBoardRow } from "../ktw/select-arrival-hours";
import type { DepartureListItem, KtwArrivalHourDto } from "../../types";

interface DepartureEnrichable {
  flight_direction?: string | null;
  planned_check_out: string;
}

function defaultPort(): KtwArrivalsPort {
  if (process.env.VITEST === "true") {
    return { listArrivals: async () => [] };
  }
  return createKatowiceBoardAdapter();
}

function toHourDto(hours: ReturnType<typeof selectArrivalHours>): KtwArrivalHourDto[] {
  return hours.map((hour) => ({
    scheduled_at: hour.scheduledAt,
    origin_label: hour.originLabel,
    ...(hour.status ? { status: hour.status } : {}),
  }));
}

type EnrichedDeparture<T> = T & Pick<DepartureListItem, "ktw_arrival_hours">;

function withoutHours<T extends DepartureEnrichable>(row: T): EnrichedDeparture<T> {
  return { ...row };
}

/** Attach matching KTW hours from an already-fetched board. Empty board omits hours. */
export function attachKtwHours<T extends DepartureEnrichable>(
  rows: readonly T[],
  board: readonly KtwBoardRow[]
): EnrichedDeparture<T>[] {
  return rows.map((row) => {
    const hours = toHourDto(
      selectArrivalHours(board, {
        flightDirection: row.flight_direction,
        plannedCheckOut: row.planned_check_out,
      })
    );
    if (hours.length === 0) return withoutHours(row);
    return { ...row, ktw_arrival_hours: hours };
  });
}

/**
 * One board fetch, then attach matching KTW hours in memory.
 * Adapter/matcher errors omit hours and keep every row.
 */
export async function enrichDepartures<T extends DepartureEnrichable>(
  rows: readonly T[],
  now: Date = new Date(),
  port: KtwArrivalsPort = defaultPort()
): Promise<EnrichedDeparture<T>[]> {
  if (rows.length === 0) return [];

  try {
    return attachKtwHours(rows, await port.listArrivals(now));
  } catch {
    return rows.map(withoutHours);
  }
}

/** One board fetch shared by pending + handled driver lists. */
export async function enrichDepartureLists<T extends DepartureEnrichable>(
  pending: readonly T[],
  handled: readonly T[],
  now: Date = new Date(),
  port: KtwArrivalsPort = defaultPort()
): Promise<{ data: EnrichedDeparture<T>[]; handled: EnrichedDeparture<T>[] }> {
  if (pending.length === 0 && handled.length === 0) {
    return { data: [], handled: [] };
  }

  try {
    const board = await port.listArrivals(now);
    return {
      data: attachKtwHours(pending, board),
      handled: attachKtwHours(handled, board),
    };
  } catch {
    return {
      data: pending.map(withoutHours),
      handled: handled.map(withoutHours),
    };
  }
}
