import { z } from "zod";

export const settingsSchema = z.object({
  daily_rate: z.number({ invalid_type_error: "Wymagana liczba" }).min(0, "Stawka nie może być ujemna"),
  total_parking_spots: z
    .number({ invalid_type_error: "Wymagana liczba" })
    .int("Musi być liczbą całkowitą")
    .min(1, "Minimalna pojemność to 1"),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
