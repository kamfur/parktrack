import type { APIRoute } from "astro";
import { z } from "zod";
import { savePriceListSchema } from "../../../lib/schemas/price-list.schema";
import {
  DuplicatePriceListStartError,
  PriceListNotFoundError,
  PriceListService,
} from "../../../lib/services/price-list.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** PUT /api/price-lists/[id] — replace a price list's period and rates. Staff-only. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const id = params.id;
  if (!id || !uuidSchema.safeParse(id).success) return json({ error: "Invalid price list ID" }, 400);

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
    await new PriceListService(locals.supabase).save(parsed.data, id);
    return json({ id });
  } catch (error) {
    if (error instanceof PriceListNotFoundError) return json({ error: error.message }, 404);
    if (error instanceof DuplicatePriceListStartError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** DELETE /api/price-lists/[id] — remove a price list. Staff-only. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const id = params.id;
  if (!id || !uuidSchema.safeParse(id).success) return json({ error: "Invalid price list ID" }, 400);

  try {
    await new PriceListService(locals.supabase).delete(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof PriceListNotFoundError) return json({ error: error.message }, 404);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
