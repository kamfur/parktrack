import type { APIRoute } from "astro";
import { DriverService, DriverServiceError } from "../../../lib/services/driver.service";

export const prerender = false;

function requireDriverOrStaff(locals: App.Locals): Response | null {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!locals.supabase) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const GET: APIRoute = async ({ locals }) => {
  const denied = requireDriverOrStaff(locals);
  if (denied) return denied;

  try {
    const service = new DriverService(locals.supabase);
    const [arrivals, handled] = await Promise.all([service.listArrivals(), service.listHandledArrivals()]);
    return new Response(JSON.stringify({ data: arrivals, handled }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
