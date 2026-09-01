import { z } from "zod";

export const settingsSchema = z.object({
  daily_rate: z.number({ invalid_type_error: "Wymagana liczba" }).min(0, "Stawka nie może być ujemna"),
  total_parking_spots: z
    .number({ invalid_type_error: "Wymagana liczba" })
    .int("Musi być liczbą całkowitą")
    .min(1, "Minimalna pojemność to 1"),
  seller_name: z.string().min(1, "Nazwa firmy jest wymagana"),
  seller_address: z.string().min(1, "Adres firmy jest wymagany"),
  seller_nip: z.string().min(1, "NIP jest wymagany"),
  seller_bank_account: z.string().min(1, "Numer konta bankowego jest wymagany"),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
