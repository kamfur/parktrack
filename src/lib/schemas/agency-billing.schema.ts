import { z } from "zod";

/** Billing month as `YYYY-MM` (month of planned check-in, Europe/Warsaw). */
export const billingMonthSchema = z
  .string({ required_error: "Miesiąc jest wymagany" })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Miesiąc musi mieć format RRRR-MM")
  .transform((value) => {
    const [year, month] = value.split("-").map(Number);
    return { year, month };
  });

export const agencyMonthQuerySchema = z.object({ month: billingMonthSchema });

export const issueAgencyInvoiceSchema = z.object({ month: billingMonthSchema });

export type BillingMonth = z.output<typeof billingMonthSchema>;
