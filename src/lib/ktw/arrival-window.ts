/** Inclusive ±3h around planned checkout, compared as instants (Europe/Warsaw ISO still names the same instant). */
export const ARRIVAL_WINDOW_MS = 3 * 60 * 60 * 1000;

function parseInstant(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function isWithinArrivalWindow(scheduledAtIso: string, plannedCheckOutIso: string): boolean {
  const scheduledMs = parseInstant(scheduledAtIso);
  const plannedMs = parseInstant(plannedCheckOutIso);
  if (scheduledMs == null || plannedMs == null) return false;
  return Math.abs(scheduledMs - plannedMs) <= ARRIVAL_WINDOW_MS;
}
