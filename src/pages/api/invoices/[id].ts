import type { APIRoute } from "astro";
import { z } from "zod";
import { InvoiceService } from "../../../lib/services/invoice.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id || !uuidSchema.safeParse(id).success) {
    return new Response(JSON.stringify({ error: "Invalid invoice ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new InvoiceService(locals.supabase);
    const invoice = await service.getById(id);

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(invoice), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
