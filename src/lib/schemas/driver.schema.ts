import { z } from "zod";

export const driverArrivalUpdateSchema = z.object({
  planned_check_out: z.string().datetime("Invalid check-out date format").optional(),
  flight_direction: z.string().max(100).optional().nullable(),
  passenger_count: z.number().int().min(0).max(99).nullable().optional(),
  parking_sector: z.string().max(50).nullable().optional(),
  license_plate: z.string().max(15).nullable().optional(),
  paid_at_arrival: z.boolean().optional(),
  actual_check_in: z.string().datetime("Invalid actual check-in date format").optional(),
});

export type DriverArrivalUpdate = z.infer<typeof driverArrivalUpdateSchema>;

export const driverDepartureUpdateSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  paid_at_departure: z.boolean().optional(),
  surcharge_amount: z.number().nonnegative().nullable().optional(),
  planned_check_out: z.string().datetime("Invalid check-out date format").optional(),
  actual_check_out: z.string().datetime("Invalid actual check-out date format").optional(),
});

export type DriverDepartureUpdate = z.infer<typeof driverDepartureUpdateSchema>;
