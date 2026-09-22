import type { APIRoute } from "astro";
import { GarageAllocationService, GarageBufferViolationError } from "../../lib/services/garage-allocation.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/garage-assignments — active garage occupancy (for the occupancy view). Staff-only. */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const entries = await new GarageAllocationService(locals.supabase).listActiveAssignments();
    return json(entries);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** PATCH /api/garage-assignments — manually swap a reservation's garage assignment. Staff-only. */
export const PATCH: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await request.json()) as { reservationId?: unknown; garageSpotId?: unknown };
    if (typeof body.reservationId !== "string" || typeof body.garageSpotId !== "string") {
      return json({ error: "Validation failed", details: "reservationId and garageSpotId are required strings" }, 400);
    }

    const assignment = await new GarageAllocationService(locals.supabase).swap(body.reservationId, body.garageSpotId);
    return json(assignment);
  } catch (error) {
    if (error instanceof GarageBufferViolationError) {
      return json({ error: error.message }, 409);
    }
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
