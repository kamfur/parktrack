import { z } from "zod";

export const createInvoiceSchema = z.object({
  reservation_id: z.string().uuid(),
  buyer_name: z.string().min(1),
  buyer_nip: z.string().min(1),
  buyer_address: z.string().min(1),
  buyer_email: z.string().email().optional(),
});
