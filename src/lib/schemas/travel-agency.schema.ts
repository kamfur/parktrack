import { z } from "zod";
import { isValidNip, normalizeNip } from "../validation/nip";

/** Optional free text: trimmed, empty string → null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null));

export const saveTravelAgencySchema = z.object({
  name: z.string().trim().min(1, "Nazwa biura jest wymagana").max(200, "Nazwa może mieć maksymalnie 200 znaków"),
  nip: z
    .string({ required_error: "NIP jest wymagany" })
    .trim()
    .min(1, "NIP jest wymagany")
    .refine(isValidNip, "Nieprawidłowy NIP (sprawdź cyfry i sumę kontrolną)")
    .transform(normalizeNip),
  address: z.string().trim().min(1, "Adres jest wymagany").max(500, "Adres może mieć maksymalnie 500 znaków"),
  email: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.string().email().safeParse(value).success, "Nieprawidłowy adres e-mail"),
  phone: optionalText(50, "Telefon może mieć maksymalnie 50 znaków"),
  contact_person: optionalText(200, "Osoba kontaktowa może mieć maksymalnie 200 znaków"),
  notes: optionalText(2000, "Uwagi mogą mieć maksymalnie 2000 znaków"),
  discount_pct: z
    .number({ invalid_type_error: "Rabat musi być liczbą" })
    .min(0, "Rabat nie może być ujemny")
    .max(100, "Rabat nie może przekraczać 100%")
    .multipleOf(0.01, "Rabat: maksymalnie 2 miejsca po przecinku"),
  payment_term_days: z
    .number({ invalid_type_error: "Termin płatności musi być liczbą" })
    .int("Termin płatności musi być liczbą całkowitą")
    .min(0, "Termin płatności nie może być ujemny")
    .max(365, "Termin płatności może wynosić maksymalnie 365 dni"),
});

export type SaveTravelAgencyInput = z.input<typeof saveTravelAgencySchema>;
export type SaveTravelAgencyCommand = z.output<typeof saveTravelAgencySchema>;

export const archiveTravelAgencySchema = z.object({ archived: z.boolean() });

export const travelAgenciesListQuerySchema = z.object({
  include_archived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
