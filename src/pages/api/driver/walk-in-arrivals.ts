import type { APIRoute } from "astro";
import { driverWalkInArrivalSchema } from "../../../lib/schemas/driver.schema";
import { DriverServiceError } from "../../../lib/services/driver.service";
import { NoGarageAvailableError, NoPriceListError } from "../../../lib/services/reservation.service";
import { createWalkInArrival } from "../../../lib/services/walk-in-arrival.service";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * POST /api/driver/walk-in-arrivals — client arrived without a reservation (driver or staff).
 * Creates the reservation with check-in = now and confirms the arrival in one request.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!locals.supabase) return json({ error: "Service unavailable" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const validation = await driverWalkInArrivalSchema.safeParseAsync(body);
  if (!validation.success) {
    return json(
      {
        error: validation.error.issues[0]?.message ?? "Validation failed",
        details: validation.error.format(),
      },
      400
    );
  }

  try {
    const reservation = await createWalkInArrival(locals.supabase, validation.data, locals.user.id);
    return json(reservation, 201);
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return json({ error: error.message }, error.statusCode);
    }
    if (error instanceof NoPriceListError) {
      return json({ error: "Brak cennika obejmującego datę przyjazdu" }, 422);
    }
    if (error instanceof NoGarageAvailableError) {
      return json({ error: error.message }, 409);
    }
    console.error("Error creating walk-in arrival:", error);
    return json({ error: "Nie udało się dodać przyjazdu" }, 500);
  }
};
