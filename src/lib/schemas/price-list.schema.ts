import { z } from "zod";
import { PRICED_DAYS } from "../pricing/price-list";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data musi mieć format RRRR-MM-DD")
  .refine((value) => !isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Nieprawidłowa data");

const price = z
  .number({ invalid_type_error: "Wymagana liczba", required_error: "Wymagana cena" })
  .min(0, "Cena nie może być ujemna")
  .max(99_999_999.99, "Cena jest zbyt wysoka");

const rateSchema = z.object({
  day_prices: z.array(price).length(PRICED_DAYS, `Wymagane ceny dla ${PRICED_DAYS} dni`),
  extra_day_price: price,
});

/** Body for POST /api/price-lists and PUT /api/price-lists/[id]. */
export const savePriceListSchema = z
  .object({
    valid_from: isoDate,
    valid_to: isoDate.nullable(),
    rates: z.object({
      open_air: rateSchema,
      carport: rateSchema,
      garage: rateSchema,
    }),
  })
  .refine((data) => data.valid_to === null || data.valid_to >= data.valid_from, {
    message: "Data końcowa nie może być wcześniejsza niż początkowa",
    path: ["valid_to"],
  });

export type SavePriceListCommand = z.infer<typeof savePriceListSchema>;
