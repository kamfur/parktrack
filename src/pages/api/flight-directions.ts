import type { APIRoute } from "astro";
import { ReservationService } from "../../lib/services/reservation.service";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!locals.supabase) {
    return json({ error: "Service unavailable" }, 503);
  }

  try {
    const data = await new ReservationService(locals.supabase).listFlightDirections();
    return json({ data });
  } catch {
    return json({ error: "An unexpected error occurred" }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
