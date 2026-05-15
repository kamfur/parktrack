import type { APIRoute } from "astro";
import type { CostCalculationResponse } from "../../types";

export const prerender = false;

/**
 * GET /api/calculate-cost
 *
 * Oblicza całkowity koszt rezerwacji na podstawie dat przyjazdu i wyjazdu.
 * Wykorzystuje funkcję bazodanową calculate_total_cost.
 *
 * Query params:
 * - check_in (required): Data przyjazdu (ISO 8601)
 * - check_out (required): Data wyjazdu (ISO 8601)
 *
 * Response: CostCalculationResponse
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Parse query parameters
    const checkIn = url.searchParams.get("check_in");
    const checkOut = url.searchParams.get("check_out");

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

    // Call database function to calculate total cost
    // Note: Parameter names must match exactly with function definition (p_check_in, p_check_out)
    const { data: totalCost, error: costError } = await locals.supabase.rpc("calculate_total_cost", {
      p_check_in: checkIn,
      p_check_out: checkOut,
    });

    if (costError) {
      throw new Error(`Failed to calculate cost: ${costError.message}`);
    }

    if (totalCost === null || totalCost === undefined) {
      throw new Error("Cost calculation returned null");
    }

    // Get cost per day (simple division)
    const costPerDay = days > 0 ? totalCost / days : 0;

    // Prepare response
    const response: CostCalculationResponse = {
      totalCost: totalCost,
      days: days,
      costPerDay: costPerDay,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
