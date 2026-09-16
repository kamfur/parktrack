import type { KtwArrivalHourDto } from "../../types";
import { warsawTimeLabel } from "../calendar/warsaw-time";

/** Board status when present (current time / delay); otherwise the scheduled Warsaw clock. */
export function formatKtwHourList(hours: KtwArrivalHourDto[] | null | undefined): string | null {
  if (!hours?.length) return null;
  return hours.map((hour) => hour.status?.trim() || warsawTimeLabel(new Date(hour.scheduled_at))).join(", ");
}
