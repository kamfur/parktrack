import type { APIRoute } from "astro";
import type { AvailabilityCheckResponse } from "../../types";

export const prerender = false;

/**
 * GET /api/availability
 *
 * Sprawdza dostępność miejsc parkingowych w zadanym zakresie dat.
 *
 * Query params:
 * - check_in (required): Data przyjazdu (ISO 8601)
 * - check_out (required): Data wyjazdu (ISO 8601)
 *
 * Response: AvailabilityCheckResponse
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

    // Get total parking spots from settings table
    const { data: settings, error: settingsError } = await locals.supabase
      .from("settings")
      .select("value")
      .eq("key", "total_parking_spots")
      .maybeSingle();

    // Default value if setting doesn't exist or error occurs
    let totalSpots = 100;

    if (settingsError) {
      console.warn("Error fetching total_parking_spots setting:", settingsError.message);
      // Use default value instead of throwing error
    } else if (settings && settings.value !== null && settings.value !== undefined) {
      // Parse value from JSONB (value is stored as JSONB, e.g. "100" or 100)
      const parsedValue = typeof settings.value === "string" ? parseInt(settings.value, 10) : Number(settings.value);

      if (!isNaN(parsedValue) && parsedValue > 0) {
        totalSpots = parsedValue;
      } else {
        console.warn("Invalid total_parking_spots setting value, using default 100");
      }
    } else {
      console.warn("total_parking_spots setting not found, using default 100");
    }

    // Check occupancy for each day in the range
    const checkInDateStr = checkInDate.toISOString().split("T")[0];
    const checkOutDateStr = checkOutDate.toISOString().split("T")[0];

    const { data: occupancy, error: occupancyError } = await locals.supabase
      .from("daily_occupancy")
      .select("date, occupied_spots")
      .gte("date", checkInDateStr)
      .lt("date", checkOutDateStr) // lt instead of lte because check-out day doesn't count
      .order("date");

    if (occupancyError) {
      throw new Error(`Failed to fetch occupancy data: ${occupancyError.message}`);
    }

    // Calculate minimum available spots across the date range
    let minAvailableSpots = totalSpots;

    if (occupancy && occupancy.length > 0) {
      for (const day of occupancy) {
        const availableOnDay = totalSpots - day.occupied_spots;
        if (availableOnDay < minAvailableSpots) {
          minAvailableSpots = availableOnDay;
        }
      }
    }

    // Prepare response
    const response: AvailabilityCheckResponse = {
      available: minAvailableSpots > 0,
      availableSpots: minAvailableSpots,
      totalSpots: totalSpots,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking availability:", error);

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
