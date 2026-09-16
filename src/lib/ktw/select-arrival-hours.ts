import { isWithinArrivalWindow } from "./arrival-window";
import { matchDirectionKey, originMatchesKey } from "./direction-match";

export interface KtwBoardRow {
  originLabel: string;
  scheduledAt: string;
}

export interface KtwArrivalHour {
  scheduledAt: string;
  originLabel: string;
}

export function selectArrivalHours(
  board: readonly KtwBoardRow[],
  input: { flightDirection: string | null | undefined; plannedCheckOut: string }
): KtwArrivalHour[] {
  const key = matchDirectionKey(input.flightDirection);
  if (!key) return [];

  return board
    .filter(
      (row) => originMatchesKey(row.originLabel, key) && isWithinArrivalWindow(row.scheduledAt, input.plannedCheckOut)
    )
    .map((row) => ({ scheduledAt: row.scheduledAt, originLabel: row.originLabel }))
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}
