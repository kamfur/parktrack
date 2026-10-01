import type { APIRoute } from "astro";
import { z } from "zod";
import { issueAgencyInvoiceSchema } from "../../../../lib/schemas/agency-billing.schema";
import { AgencyBillingService, AgencyInvoiceRuleError } from "../../../../lib/services/agency-billing.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/travel-agencies/[id]/invoices — the agency's invoices, newest period first. Staff-only. */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  try {
    return json(await new AgencyBillingService(locals.supabase).listInvoices(params.id));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/**
 * POST /api/travel-agencies/[id]/invoices `{ month: "YYYY-MM" }` — issue the monthly VAT invoice.
 * 409 with `blocking` rows while arrivals are unresolved; 422 while the month is open or empty. Staff-only.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = issueAgencyInvoiceSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  const service = new AgencyBillingService(locals.supabase);
  try {
    const invoiceId = await service.issueInvoice(params.id, parsed.data.month);
    return json({ invoiceId }, 201);
  } catch (error) {
    if (error instanceof AgencyInvoiceRuleError) {
      switch (error.code) {
        case "BLOCKING_RESERVATIONS": {
          const summary = await service.getMonthSummary(params.id, parsed.data.month);
          const blocking = summary.rows.filter((row) => row.category === "blocking");
          return json({ error: error.message, code: error.code, blocking }, 409);
        }
        case "ALREADY_INVOICED":
          return json({ error: error.message, code: error.code }, 409);
        case "AGENCY_NOT_FOUND":
          return json({ error: error.message, code: error.code }, 404);
        default:
          return json({ error: error.message, code: error.code }, 422);
      }
    }
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
