import type { APIRoute } from "astro";
import { z } from "zod";
import { GarageAllocationService } from "../../../../lib/services/garage-allocation.service";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const querySchema = z
  .object({
    type: z.enum(["garage", "carport"]),
    check_in: z.string().datetime(),
    check_out: z.string().datetime(),
    /** Existing reservation being edited — its own assignment does not block its current spot. */
    reservation_id: z.string().uuid().optional(),
  })
  .refine((q) => Date.parse(q.check_out) > Date.parse(q.check_in), { path: ["check_out"] });

/**
 * GET /api/driver/garage-spots/available — garage/carport spots free for a stay window
 * (10h buffer kept), for picking a specific spot on a reservation. Staff AND driver; read-only.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.format() }, 400);

  try {
    const { type, check_in, check_out, reservation_id } = parsed.data;
    const spots = await new GarageAllocationService(locals.supabase).listAvailableSpots(
      check_in,
      check_out,
      type,
      reservation_id
    );
    return json(spots);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
