import type { APIRoute } from "astro";
import { GarageSpotService } from "../../../lib/services/garage-spot.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * GET /api/driver/garage-spots — garage/carport spots, read-only.
 * Staff AND driver (unlike /api/garage-spots, which is staff-only) — drivers
 * see the garage occupancy grid but cannot configure spots.
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const spots = await new GarageSpotService(locals.supabase).list();
    return json(spots);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
