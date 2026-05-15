import { ReservationService } from "@/lib/services/reservation.service";
import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  try {
    // Get today's departures using the service
    const service = new ReservationService(locals.supabase);
    const todaysDepartures = await service.getTodaysDepartures();

    // Return success response with the reservations data
    return new Response(JSON.stringify(todaysDepartures), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching today's departures:", error);

    // Handle database errors
    if (error instanceof Error && error.message.includes("Failed to fetch today's departures")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    return new Response(JSON.stringify({ error: "An unexpected error occurred while fetching today's departures" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
