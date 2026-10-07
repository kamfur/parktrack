import type { APIRoute } from "astro";
import { z } from "zod";
import { agencyMonthQuerySchema } from "../../../../lib/schemas/agency-billing.schema";
import { AgencyBillingService } from "../../../../lib/services/agency-billing.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * GET /api/travel-agencies/[id]/summary?month=YYYY-MM — agency reservations for the billing
 * month (planned check-in, Europe/Warsaw) with categories and the amount to invoice. Staff-only.
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  const parsed = agencyMonthQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  try {
    const summary = await new AgencyBillingService(locals.supabase).getMonthSummary(params.id, parsed.data.month);
    return json(summary);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
