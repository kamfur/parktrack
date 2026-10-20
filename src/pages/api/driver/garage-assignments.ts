import type { APIRoute } from "astro";
import { GarageAllocationService, GarageBufferViolationError } from "../../../lib/services/garage-allocation.service";
import { garageAssignmentSwapSchema } from "../../../lib/schemas/garage-spot.schema";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * GET /api/driver/garage-assignments — active garage occupancy.
 * Staff AND driver (unlike /api/garage-assignments, which is staff-only).
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const entries = await new GarageAllocationService(locals.supabase).listActiveAssignments();
    return json(entries);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/**
 * PATCH /api/driver/garage-assignments — move a reservation to another garage/carport spot
 * (occupancy view). Staff AND driver. Drivers have no write RLS on garage_assignments, so the
 * swap runs with the admin client after the session check; the 10h buffer is still enforced.
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const validationResult = await garageAssignmentSwapSchema.safeParseAsync(await request.json());
    if (!validationResult.success) {
      return json({ error: "Validation failed", details: validationResult.error.format() }, 400);
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return json({ error: "Admin client not available" }, 500);

    const { reservationId, garageSpotId } = validationResult.data;
    const assignment = await new GarageAllocationService(adminClient).swap(reservationId, garageSpotId);
    return json(assignment);
  } catch (error) {
    if (error instanceof GarageBufferViolationError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
