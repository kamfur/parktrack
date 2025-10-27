import type { APIRoute } from "astro";
import { ReservationService } from "../../../lib/services/reservation.service";
import type { CreateExternalReservationCommand } from "../../../types";

export const prerender = false;

// Constant-time string comparison to prevent timing attacks
const safeCompare = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  return a.split("").reduce((acc, char, i) => acc && char === b[i], true);
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || !safeCompare(apiKey, import.meta.env.API_SECRET_KEY)) {
      return new Response(
        JSON.stringify({
          error: { message: "Forbidden: Invalid or missing API key" },
        }),
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as CreateExternalReservationCommand;

    // Create reservation
    const service = new ReservationService(locals.supabase);
    const reservationId = await service.createExternalReservation(body);

    return new Response(
      JSON.stringify({
        reservationId,
        message: "Reservation created successfully",
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating external reservation:", error);

    if (error instanceof Error) {
      // Handle validation errors
      if (error.name === "ZodError") {
        return new Response(
          JSON.stringify({
            error: { message: "Invalid input: " + error.message },
          }),
          { status: 400 }
        );
      }

      // Handle business rule violations
      if (error.message.includes("No available parking spots")) {
        return new Response(
          JSON.stringify({
            error: { message: error.message },
          }),
          { status: 409 }
        );
      }
    }

    // Handle unexpected errors
    return new Response(
      JSON.stringify({
        error: { message: "An unexpected error occurred. Please try again later." },
      }),
      { status: 500 }
    );
  }
};
