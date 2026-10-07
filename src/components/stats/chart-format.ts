import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import type { AnalyticsGranularity } from "@/types";

export function formatBucket(bucket: string, granularity: AnalyticsGranularity, long = false): string {
  if (granularity === "month") {
    return format(parseISO(`${bucket}-01`), long ? "LLLL yyyy" : "LLL yy", { locale: pl });
  }
  return format(parseISO(bucket), long ? "EEE, d MMMM yyyy" : "dd.MM", { locale: pl });
}

export function formatPln(value: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(value);
}

export const PARKING_TYPE_LABELS: Record<string, string> = {
  open_air: "Plac",
  carport: "Wiata",
  garage: "Garaż",
};

export const SOURCE_LABELS: Record<string, string> = {
  phone: "Telefon",
  walk_in: "Walk-in",
  api: "API / strona",
};

export const CUSTOMER_LABELS: Record<string, string> = {
  individual: "Indywidualni",
  agency: "Biura podróży",
};
