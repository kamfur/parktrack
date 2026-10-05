import type { APIRoute } from "astro";
import { z } from "zod";
import type { CostCalculationResponse } from "../../types";
import { PARKING_TYPES } from "../../lib/pricing/parking-type";
import { MAX_VEHICLE_COUNT } from "../../lib/vehicles";
import {
  NoPriceListError,
  ReservationService,
  TravelAgencyUnavailableError,
} from "../../lib/services/reservation.service";

export const prerender = false;

/**
 * GET /api/calculate-cost
 *
 * Oblicza całkowity koszt rezerwacji na podstawie dat przyjazdu i wyjazdu
 * z cennika obowiązującego w dniu przyjazdu (funkcja bazodanowa calculate_total_cost).
 *
 * Query params:
 * - check_in (required): Data przyjazdu (ISO 8601)
 * - check_out (required): Data wyjazdu (ISO 8601)
 * - parking_type (optional): open_air (domyślnie) | carport | garage
 * - travel_agency_id (optional): UUID biura — cena po rabacie biura (podgląd; baza liczy ostatecznie)
 * - vehicle_count (optional): liczba aut w rezerwacji (domyślnie 1) — cena × liczba aut
 *
 * Response: CostCalculationResponse
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Parse query parameters
    const checkIn = url.searchParams.get("check_in");
    const checkOut = url.searchParams.get("check_out");
    const parkingTypeResult = z
      .enum(PARKING_TYPES)
      .default("open_air")
      .safeParse(url.searchParams.get("parking_type") ?? undefined);

    const travelAgencyResult = z
      .string()
      .uuid()
      .optional()
      .safeParse(url.searchParams.get("travel_agency_id") || undefined);

    const vehicleCountResult = z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_VEHICLE_COUNT)
      .default(1)
      .safeParse(url.searchParams.get("vehicle_count") || undefined);

    if (!vehicleCountResult.success) {
      return new Response(JSON.stringify({ error: `vehicle_count must be an integer 1-${MAX_VEHICLE_COUNT}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!travelAgencyResult.success) {
      return new Response(JSON.stringify({ error: "travel_agency_id must be a valid UUID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!parkingTypeResult.success) {
      return new Response(JSON.stringify({ error: `parking_type must be one of: ${PARKING_TYPES.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate required parameters
    if (!checkIn || !checkOut) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: check_in and check_out are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate date format
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return new Response(
        JSON.stringify({
          error: "Invalid date format. Dates must be in ISO 8601 format",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate date range
    if (checkOutDate <= checkInDate) {
      return new Response(
        JSON.stringify({
          error: "check_out date must be after check_in date",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Calculate days
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const days = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerDay);

    const { baseCost, discountPct, totalCost } = await new ReservationService(locals.supabase).quoteCost(
      checkIn,
      checkOut,
      parkingTypeResult.data,
      travelAgencyResult.data,
      vehicleCountResult.data
    );

    // Get cost per day (simple division)
    const costPerDay = days > 0 ? totalCost / days : 0;

    // Prepare response
    const response: CostCalculationResponse = {
      totalCost: totalCost,
      days: days,
      costPerDay: costPerDay,
      baseCost,
      discountPct,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TravelAgencyUnavailableError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (error instanceof NoPriceListError) {
      return new Response(JSON.stringify({ error: "Brak cennika obejmującego datę przyjazdu" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("Error calculating cost:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
