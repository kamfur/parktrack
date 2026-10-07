import type { APIRoute } from "astro";
import { saveTravelAgencySchema, travelAgenciesListQuerySchema } from "../../lib/schemas/travel-agency.schema";
import { DuplicateNipError, TravelAgencyService } from "../../lib/services/travel-agency.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/travel-agencies[?include_archived=true] — agencies by name. Staff-only (see authMiddleware). */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const parsed = travelAgenciesListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  try {
    const agencies = await new TravelAgencyService(locals.supabase).list(parsed.data.include_archived);
    return json(agencies);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** POST /api/travel-agencies — create an agency. Staff-only. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const parsed = saveTravelAgencySchema.safeParse(body);
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  try {
    const agency = await new TravelAgencyService(locals.supabase).create(parsed.data);
    return json(agency, 201);
  } catch (error) {
    if (error instanceof DuplicateNipError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
