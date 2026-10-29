import type { APIRoute } from "astro";
import { driverShiftWriteSchema, idSchema } from "../../../lib/schemas/calendar.schema";
import { ShiftService, ShiftServiceError } from "../../../lib/services/shift.service";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const id = idSchema.safeParse(params.id);
  if (!id.success) return json({ error: "Invalid shift id" }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const validation = driverShiftWriteSchema.safeParse(body);
  if (!validation.success) return json({ error: "Validation failed", details: validation.error.format() }, 400);

  try {
    const shift = await new ShiftService(locals.supabase).update(id.data, validation.data);
    return json(shift);
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const id = idSchema.safeParse(params.id);
  if (!id.success) return json({ error: "Invalid shift id" }, 400);

  try {
    await new ShiftService(locals.supabase).delete(id.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
};

function handleError(error: unknown): Response {
  if (error instanceof ShiftServiceError) return json({ error: error.message }, error.statusCode);
  return json({ error: "An unexpected error occurred" }, 500);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
