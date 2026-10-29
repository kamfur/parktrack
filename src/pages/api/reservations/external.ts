import type { APIRoute } from "astro";
import { NoPriceListError, ReservationService } from "../../../lib/services/reservation.service";
import { createExternalReservationSchema } from "../../../lib/schemas/reservation.schema";
import { verifyApiKey } from "../../../lib/auth/api-key";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ request, locals }) => {
  // Machine auth: public route in middleware, key checked here.
  const keyCheck = verifyApiKey(request.headers.get("x-api-key"), import.meta.env.API_SECRET_KEY);
  if (keyCheck === "missing_secret") {
    // eslint-disable-next-line no-console
    console.error("API_SECRET_KEY is not configured; rejecting external reservation request");
    return json({ error: { code: "not_configured", message: "External API is not configured." } }, 503);
  }
  if (keyCheck === "invalid") {
    return json({ error: { code: "unauthorized", message: "Invalid or missing API key." } }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: { code: "validation_error", message: "Request body must be valid JSON." } }, 400);
  }

  const parsed = createExternalReservationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: { code: "validation_error", message: "Invalid input", details: parsed.error.flatten() } },
      400
    );
  }

  try {
    const service = new ReservationService(locals.supabase);
    const reservationId = await service.createExternalReservation(parsed.data);

    return json({ reservationId, message: "Reservation created successfully" }, 201);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error creating external reservation:", error);

    // Handle business rule violations
    if (error instanceof Error && error.message.includes("No available parking spots")) {
      return json({ error: { message: error.message } }, 409);
    }
    if (error instanceof NoPriceListError) {
      return json({ error: { code: "no_price_list", message: "No price list covers the check-in date." } }, 422);
    }

    return json({ error: { message: "An unexpected error occurred. Please try again later." } }, 500);
  }
};
