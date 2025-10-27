import { z } from "zod";

/**
 * Schema for validating external reservation requests.
 * Maps to CreateExternalReservationCommand type.
 */
export const createExternalReservationSchema = z
  .object({
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(9, "Phone number must be at least 9 characters"),
    licensePlate: z.string().min(1, "License plate is required"),
    checkInDate: z.string().datetime("Invalid check-in date format"),
    checkOutDate: z.string().datetime("Invalid check-out date format"),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      return checkOut > checkIn;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }
  );

export type CreateExternalReservationSchema = typeof createExternalReservationSchema;
