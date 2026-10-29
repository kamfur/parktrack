import type { APIRoute } from "astro";
import { savePriceListSchema } from "../../lib/schemas/price-list.schema";
import { DuplicatePriceListStartError, PriceListService } from "../../lib/services/price-list.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/price-lists — all price lists with their rates. Staff-only (see authMiddleware). */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const lists = await new PriceListService(locals.supabase).list();
    return json(lists);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** POST /api/price-lists — create a price list for a period. Staff-only. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = savePriceListSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const id = await new PriceListService(locals.supabase).save(parsed.data);
    return json({ id }, 201);
  } catch (error) {
    if (error instanceof DuplicatePriceListStartError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
