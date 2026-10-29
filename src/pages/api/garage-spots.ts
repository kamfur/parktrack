import type { APIRoute } from "astro";
import { GarageSpotService } from "../../lib/services/garage-spot.service";
import type { CreateGarageSpotCommand, UpdateGarageSpotCommand } from "../../types";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseGarageSpotId(raw: string | null): string | null {
  if (!raw) return null;
  const id = raw.startsWith("eq.") ? raw.slice(3) : raw;
  return UUID_REGEX.test(id) ? id : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/garage-spots — list all garage/carport spots. Staff-only (see authMiddleware). */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const spots = await new GarageSpotService(locals.supabase).list();
    return json(spots);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** POST /api/garage-spots — create a garage/carport spot. Staff-only. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const body: CreateGarageSpotCommand = await request.json();
    const spot = await new GarageSpotService(locals.supabase).create(body);
    return json(spot, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return json({ error: "Validation failed", details: error.message }, 400);
    }
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** PATCH /api/garage-spots?id=<uuid> — update a garage/carport spot. Staff-only. */
export const PATCH: APIRoute = async ({ request, locals, url }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const spotId = parseGarageSpotId(url.searchParams.get("id"));
  if (!spotId) {
    return json(
      {
        error: url.searchParams.get("id")
          ? "Invalid garage spot ID format. Must be a valid UUID."
          : "Garage spot ID is required as query parameter 'id'",
      },
      400
    );
  }

  try {
    const body: UpdateGarageSpotCommand = await request.json();
    const spot = await new GarageSpotService(locals.supabase).update(spotId, body);
    return json(spot);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return json({ error: "Validation failed", details: error.message }, 400);
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return json({ error: error.message }, 404);
    }
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
