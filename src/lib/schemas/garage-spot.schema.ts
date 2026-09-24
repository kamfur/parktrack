import { z } from "zod";

/**
 * Schema for creating a garage/carport spot.
 * Maps to CreateGarageSpotCommand.
 */
export const createGarageSpotSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  spot_type: z.enum(["garage", "carport"], {
    errorMap: () => ({ message: "Spot type must be one of: garage, carport" }),
  }),
  capacity_label: z.enum(["single", "double"], {
    errorMap: () => ({ message: "Capacity label must be one of: single, double" }),
  }),
  price_per_day: z.number().positive("Price per day must be a positive number"),
  is_available: z.boolean().optional(),
});

export type CreateGarageSpotSchema = typeof createGarageSpotSchema;

/** Configurator dialog form (create + edit) — availability is toggled separately from the list row. */
export const garageSpotFormSchema = createGarageSpotSchema.omit({ is_available: true });

export type GarageSpotFormData = z.infer<typeof garageSpotFormSchema>;

/**
 * Schema for updating a garage/carport spot. All fields optional (partial update).
 * Maps to UpdateGarageSpotCommand.
 */
export const updateGarageSpotSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").optional(),
  spot_type: z
    .enum(["garage", "carport"], {
      errorMap: () => ({ message: "Spot type must be one of: garage, carport" }),
    })
    .optional(),
  capacity_label: z
    .enum(["single", "double"], {
      errorMap: () => ({ message: "Capacity label must be one of: single, double" }),
    })
    .optional(),
  price_per_day: z.number().positive("Price per day must be a positive number").optional(),
  is_available: z.boolean().optional(),
});

export type UpdateGarageSpotSchema = typeof updateGarageSpotSchema;

/** Body for PATCH /api/garage-assignments (manual swap). */
export const garageAssignmentSwapSchema = z.object({
  reservationId: z.string().uuid("reservationId must be a valid UUID"),
  garageSpotId: z.string().uuid("garageSpotId must be a valid UUID"),
});

export type GarageAssignmentSwapSchema = typeof garageAssignmentSwapSchema;
