import { z } from "zod";

/** Form schema for driver arrival card — maps to driverArrivalUpdateSchema on submit. */
export const driverArrivalFormSchema = z.object({
  planned_check_out: z.string().optional(),
  flight_direction: z.enum(["departure", "arrival"]).optional().nullable(),
  passenger_count: z.number().int().min(0).max(99).nullable().optional(),
  parking_sector: z.string().max(50).optional(),
  paid_at_arrival: z.boolean(),
});

export type DriverArrivalFormData = z.infer<typeof driverArrivalFormSchema>;

export const driverDepartureFormSchema = z.object({
  notes: z.string().max(1000).optional(),
  paid_at_departure: z.boolean(),
  surcharge_amount: z.number().nonnegative().nullable().optional(),
  planned_check_out: z.string().optional(),
});

export type DriverDepartureFormData = z.infer<typeof driverDepartureFormSchema>;

/** Convert datetime-local value to ISO, or undefined if empty. */
export function datetimeLocalToIso(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
