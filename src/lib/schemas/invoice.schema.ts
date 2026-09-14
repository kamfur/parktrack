import { z } from "zod";

export const INVOICE_SORT_COLUMNS = ["created_at", "invoice_number", "buyer_name", "total_amount"] as const;

export const INVOICE_PAGE_SIZES = [10, 25, 50, 100] as const;

export const invoicesListQuerySchema = z.object({
  search: z.string().trim().max(100).catch("").default(""),
  sort_by: z.enum(INVOICE_SORT_COLUMNS).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .refine((v): v is (typeof INVOICE_PAGE_SIZES)[number] => INVOICE_PAGE_SIZES.includes(v as never), {
      message: `Invalid limit. Allowed: ${INVOICE_PAGE_SIZES.join(", ")}`,
    })
    .default(25),
});

export const createInvoiceSchema = z.object({
  reservation_id: z.string().uuid(),
  buyer_name: z.string().min(1),
  buyer_nip: z.string().min(1),
  buyer_address: z.string().min(1),
  buyer_email: z.string().email().optional(),
});
