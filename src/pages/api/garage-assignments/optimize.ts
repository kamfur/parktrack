import type { APIRoute } from "astro";
import { GarageOptimizationService } from "../../../lib/services/garage-optimization.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** GET /api/garage-assignments/optimize — descriptive downtime-reduction suggestions. Staff-only. No auto-apply. */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  try {
    const suggestions = await new GarageOptimizationService(locals.supabase).suggestOptimizations();
    return json(suggestions);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
