import type { APIRoute } from "astro";
import { GarageAllocationService } from "../../../lib/services/garage-allocation.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * GET /api/driver/garage-assignments — active garage occupancy, read-only.
 * Staff AND driver (unlike /api/garage-assignments, which is staff-only for
 * writes) — drivers need to see their own reservation's assigned spot.
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
