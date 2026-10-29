import type { APIRoute } from "astro";
import { NoPriceListError, ReservationService } from "@/lib/services/reservation.service";
import { createLegacyDepartureSchema } from "@/lib/schemas/reservation.schema";

export const prerender = false;

/**
 * TEMPORARY (go-live migration): staff registers a car already on the lot so its
 * return can be handled from the dashboard. Staff-only via the `/api/reservations` prefix.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = await createLegacyDepartureSchema.safeParseAsync(body);
  if (!validation.success) {
    return new Response(JSON.stringify({ error: "Validation failed", details: validation.error.format() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new ReservationService(locals.supabase);
    const reservation = await service.createLegacyDeparture(validation.data, locals.user?.id);
    return new Response(JSON.stringify(reservation), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating legacy departure:", error);

    if (error instanceof NoPriceListError) {
      return new Response(JSON.stringify({ error: "Brak cennika na dziś — podaj kwotę ręcznie" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
