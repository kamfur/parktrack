import type { APIRoute } from "astro";

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
        // Debug: Check if any settings exist and what keys are available
        const { data: allSettings, error: allError } = await locals.supabase.from("settings").select("key");
        if (allError) {
          console.error("Error fetching all settings:", allError);
        }
        const availableKeys = allSettings?.map((s) => s.key) || [];
        const errorMessage =
          availableKeys.length > 0
            ? `Setting '${key}' not found. Available keys: ${availableKeys.join(", ")}`
            : `Setting '${key}' not found. No settings found in database.`;

        return new Response(JSON.stringify({ error: errorMessage }), {
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
 * POST /api/settings
 * Creates a new setting or initializes default settings if they don't exist.
 *
 * Body: { key: string, value: any, description?: string }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();

    if (!body.key || body.value === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields: 'key' and 'value' are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if setting already exists
    const { data: existing } = await locals.supabase.from("settings").select("key").eq("key", body.key).maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: `Setting with key '${body.key}' already exists` }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get current user ID (or use system user)
    // For now, we'll use a default system user ID
    // In production, this should come from authenticated user session
    const userId = locals.user?.id || "00000000-0000-0000-0000-000000000000";

    // Use upsert to create or update setting
    const { data, error } = await locals.supabase
      .from("settings")
      .upsert(
        {
          key: body.key,
          value: body.value,
          description: body.description || null,
          updated_by: userId,
        },
        {
          onConflict: "key",
        }
      )
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
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
export const PATCH: APIRoute = async ({ url, request, locals }) => {
  try {
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

    const { data, error } = await locals.supabase
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
