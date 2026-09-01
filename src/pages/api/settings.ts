import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";

export const prerender = false;

/**
 * GET /api/settings
 * Returns application settings.
 *
 * Query parameters:
 * - key=eq.<setting_key> - filter by specific setting key
 *
 * Examples:
 * - GET /api/settings - returns all settings
 * - GET /api/settings?key=eq.total_parking_spots - returns only total_parking_spots
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const keyParam = url.searchParams.get("key");

    // If key parameter is provided, return single setting
    if (keyParam && keyParam.startsWith("eq.")) {
      const key = keyParam.substring(3); // Remove 'eq.' prefix

      const { data, error } = await locals.supabase.from("settings").select("*").eq("key", key).maybeSingle();

      if (error) {
        console.error("Settings query error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!data) {
        return new Response(JSON.stringify({ error: `Setting '${key}' not found.` }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If no key parameter, return all settings
    const { data, error } = await locals.supabase.from("settings").select("*");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data || []), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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

/**
 * PATCH /api/settings
 * Updates a setting value.
 *
 * Query parameters:
 * - key=eq.<setting_key> - filter by specific setting key
 *
 * Body: { value: any }
 */
export const PATCH: APIRoute = async ({ url, request }) => {
  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY env var" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const keyParam = url.searchParams.get("key");

    if (!keyParam || !keyParam.startsWith("eq.")) {
      return new Response(JSON.stringify({ error: "Missing or invalid key parameter. Use: key=eq.<setting_key>" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const key = keyParam.substring(3);
    const body = await request.json();

    if (!("value" in body)) {
      return new Response(JSON.stringify({ error: "Missing 'value' in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("settings")
      .update({ value: body.value })
      .eq("key", key)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.code === "PGRST116" ? 404 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
