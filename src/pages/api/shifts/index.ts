import type { APIRoute } from "astro";
import { driverShiftWriteSchema, shiftRangeQuerySchema } from "../../../lib/schemas/calendar.schema";
import { ShiftService, ShiftServiceError } from "../../../lib/services/shift.service";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const validation = shiftRangeQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!validation.success) return json({ error: "Validation failed", details: validation.error.format() }, 400);

  try {
    const shifts = await new ShiftService(locals.supabase).list(validation.data.from, validation.data.to);
    return json({ data: shifts });
  } catch (error) {
    return handleError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const validation = driverShiftWriteSchema.safeParse(body);
  if (!validation.success) return json({ error: "Validation failed", details: validation.error.format() }, 400);

  try {
    const shift = await new ShiftService(locals.supabase).create(validation.data);
    return json(shift, 201);
  } catch (error) {
    return handleError(error);
  }
};

async function readJson(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
}

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
