import type { APIRoute } from "astro";
import { ReservationService } from "../../../lib/services/reservation.service";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  try {
    // Get today's arrivals using the service
    const service = new ReservationService(locals.supabase);
    const todaysArrivals = await service.getTodaysArrivals();

    // Return success response with the reservations data
    return new Response(JSON.stringify(todaysArrivals), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching today's arrivals:", error);

    // Handle database errors
    if (error instanceof Error && error.message.includes("Failed to fetch today's arrivals")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    return new Response(JSON.stringify({ error: "An unexpected error occurred while fetching today's arrivals" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
