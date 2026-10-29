import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";
import { DriverDirectoryError, DriverDirectoryService } from "../../lib/services/driver-directory.service";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return json({ error: "Admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY env var" }, 503);
  }

  try {
    const drivers = await new DriverDirectoryService(admin).listDrivers();
    return json({ data: drivers });
  } catch (error) {
    if (error instanceof DriverDirectoryError) return json({ error: error.message }, error.statusCode);
    return json({ error: "An unexpected error occurred" }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
