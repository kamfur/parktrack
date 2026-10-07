import { z } from "zod";

export const settingsSchema = z.object({
  total_parking_spots: z
    .number({ invalid_type_error: "Wymagana liczba" })
    .int("Musi być liczbą całkowitą")
    .min(1, "Minimalna pojemność to 1"),
  seller_name: z.string().min(1, "Nazwa firmy jest wymagana"),
  seller_address: z.string().min(1, "Adres firmy jest wymagany"),
  seller_nip: z.string().min(1, "NIP jest wymagany"),
  seller_bank_account: z.string().min(1, "Numer konta bankowego jest wymagany"),
  vat_rate: z
    .number({ invalid_type_error: "Wymagana liczba" })
    .min(0, "Stawka VAT nie może być ujemna")
    .max(100, "Stawka VAT nie może przekraczać 100%")
    .multipleOf(0.01, "Maksymalnie 2 miejsca po przecinku"),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
