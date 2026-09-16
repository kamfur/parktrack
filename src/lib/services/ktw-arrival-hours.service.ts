import { createKatowiceBoardAdapter } from "../ktw/katowice-board.adapter";
import type { KtwArrivalsPort } from "../ktw/ktw-arrivals.port";
import { selectArrivalHours } from "../ktw/select-arrival-hours";
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

/**
 * One board fetch, then attach matching KTW hours in memory.
 * Adapter/matcher errors omit hours and keep every row.
 */
export async function enrichDepartures<T extends DepartureEnrichable>(
  rows: readonly T[],
  now: Date = new Date(),
  port: KtwArrivalsPort = defaultPort()
): Promise<(T & Pick<DepartureListItem, "ktw_arrival_hours">)[]> {
  if (rows.length === 0) return [];

  try {
    const board = await port.listArrivals(now);
    return rows.map((row) => {
      const hours = toHourDto(
        selectArrivalHours(board, {
          flightDirection: row.flight_direction,
          plannedCheckOut: row.planned_check_out,
        })
      );
      if (hours.length === 0) return { ...row };
      return { ...row, ktw_arrival_hours: hours };
    });
  } catch {
    return rows.map((row) => ({ ...row }));
  }
}
