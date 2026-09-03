import type { APIRoute } from "astro";

export const prerender = false;

/**
 * GET /api/health
 * Health check endpoint that verifies Supabase connection and basic database access.
 *
 * Response:
 * - 200 OK: Connection working
 * - 500 Error: Connection or database issue
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Check if Supabase client is initialized
    if (!locals.supabase) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Supabase client not initialized",
          details: "Missing SUPABASE_URL or SUPABASE_KEY environment variables",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Test 1: Simple query to settings table (should work even if empty)
    const { error: settingsError } = await locals.supabase.from("settings").select("key").limit(1);

    if (settingsError) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Database connection failed",
          details: settingsError.message,
          errorCode: settingsError.code,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Test 2: Try to get count of settings
    const { count, error: countError } = await locals.supabase
      .from("settings")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Database query failed",
          details: countError.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Test 3: Check if total_parking_spots setting exists
    const { data: parkingSpotsSetting } = await locals.supabase
      .from("settings")
      .select("key, value")
      .eq("key", "total_parking_spots")
      .maybeSingle();

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Supabase connection is working",
        database: {
          connected: true,
          settingsCount: count || 0,
          totalParkingSpots: parkingSpotsSetting
            ? {
                exists: true,
                value: parkingSpotsSetting.value,
                parsedValue:
                  typeof parkingSpotsSetting.value === "string"
                    ? parseInt(parkingSpotsSetting.value, 10)
                    : Number(parkingSpotsSetting.value),
              }
            : { exists: false },
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Unexpected error during health check",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
