import { isWithinArrivalWindow } from "./arrival-window";
import { matchDirectionKey, originMatchesKey } from "./direction-match";

export interface KtwBoardRow {
  originLabel: string;
  scheduledAt: string;
  /** Live board status, e.g. "PRZYLOT 00:07" or "WYLĄDOWAŁ 01:24". */
  status?: string;
}

export interface KtwArrivalHour {
  scheduledAt: string;
  originLabel: string;
  status?: string;
}

export const MAX_DISPLAYED_ARRIVAL_HOURS = 3;

function toHour(row: KtwBoardRow): KtwArrivalHour {
  return {
    scheduledAt: row.scheduledAt,
    originLabel: row.originLabel,
    ...(row.status ? { status: row.status } : {}),
  };
}

/** The 3 matches closest to planned return, then listed in scheduled order. */
export function selectArrivalHours(
  board: readonly KtwBoardRow[],
  input: { flightDirection: string | null | undefined; plannedCheckOut: string }
): KtwArrivalHour[] {
  const key = matchDirectionKey(input.flightDirection);
  if (!key) return [];

  const plannedMs = Date.parse(input.plannedCheckOut);
  const matched = board
    .filter(
      (row) => originMatchesKey(row.originLabel, key) && isWithinArrivalWindow(row.scheduledAt, input.plannedCheckOut)
    )
    .map(toHour);

  return matched
    .sort((a, b) => {
      const byNearness =
        Math.abs(Date.parse(a.scheduledAt) - plannedMs) - Math.abs(Date.parse(b.scheduledAt) - plannedMs);
      return byNearness !== 0 ? byNearness : Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
    })
    .slice(0, MAX_DISPLAYED_ARRIVAL_HOURS)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}
