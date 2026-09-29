import type { APIRoute } from "astro";
import { z } from "zod";
import { DriverService, DriverServiceError } from "../../../../../lib/services/driver.service";

export const prerender = false;

const querySchema = z.object({
  id: z.string().uuid(),
  check_out: z.string().datetime({ offset: true }),
});

/**
 * GET /api/driver/reservations/:id/quote?check_out=ISO
 * Price the stay would have with the given return date (driver + staff; used by arrival/departure dialogs).
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
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

  const parsed = querySchema.safeParse({ id: params.id, check_out: url.searchParams.get("check_out") });
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.format() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new DriverService(locals.supabase);
    const totalCost = await service.quoteCheckout(parsed.data.id, parsed.data.check_out);
    return new Response(JSON.stringify({ total_cost: totalCost }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
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
