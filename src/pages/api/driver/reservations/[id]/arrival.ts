import type { APIRoute } from "astro";
import { z } from "zod";
import { driverArrivalUpdateSchema } from "../../../../../lib/schemas/driver.schema";
import { DriverService, DriverServiceError } from "../../../../../lib/services/driver.service";

export const prerender = false;

const idSchema = z.string().uuid();

export const PATCH: APIRoute = async ({ params, request, locals }) => {
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

  const idResult = idSchema.safeParse(params.id);
  if (!idResult.success) {
    return new Response(JSON.stringify({ error: "Invalid reservation id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = await driverArrivalUpdateSchema.safeParseAsync(body);
  if (!validation.success) {
    return new Response(JSON.stringify({ error: "Validation failed", details: validation.error.format() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const service = new DriverService(locals.supabase);
    const reservation = await service.confirmArrival(idResult.data, validation.data);
    return new Response(JSON.stringify(reservation), {
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
