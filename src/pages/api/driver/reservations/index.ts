import type { APIRoute } from "astro";
import { driverCreateReservationSchema } from "../../../../lib/schemas/driver.schema";
import {
  NoGarageAvailableError,
  NoPriceListError,
  ReservationService,
} from "../../../../lib/services/reservation.service";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * POST /api/driver/reservations — driver (or staff) adds a reservation from the driver module.
 * Narrow payload (no price/agency/payment); priced server-side, audited as the signed-in user.
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

  const validation = await driverCreateReservationSchema.safeParseAsync(body);
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
    const service = new ReservationService(locals.supabase);
    const reservation = await service.createReservation({ ...validation.data, source: "walk_in" }, locals.user.id);
    return json(reservation, 201);
  } catch (error) {
    if (error instanceof NoPriceListError) {
      return json({ error: "Brak cennika obejmującego datę przyjazdu" }, 422);
    }
    if (error instanceof NoGarageAvailableError) {
      return json({ error: error.message }, 409);
    }
    console.error("Error creating driver reservation:", error);
    return json({ error: "Nie udało się utworzyć rezerwacji" }, 500);
  }
};
