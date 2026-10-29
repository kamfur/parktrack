import type { APIRoute } from "astro";
import { z } from "zod";
import { archiveTravelAgencySchema, saveTravelAgencySchema } from "../../../lib/schemas/travel-agency.schema";
import {
  DuplicateNipError,
  TravelAgencyInUseError,
  TravelAgencyNotFoundError,
  TravelAgencyService,
} from "../../../lib/services/travel-agency.service";

export const prerender = false;

const uuidSchema = z.string().uuid();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

/** GET /api/travel-agencies/[id] — one agency (archived included). Staff-only. */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  try {
    const agency = await new TravelAgencyService(locals.supabase).getById(params.id);
    if (!agency) return json({ error: "Travel agency not found" }, 404);
    return json(agency);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** PUT /api/travel-agencies/[id] — replace agency data. Staff-only. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  const read = await readJson(request);
  if (!read.ok) return json({ error: "Request body must be valid JSON" }, 400);

  const parsed = saveTravelAgencySchema.safeParse(read.body);
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  try {
    const agency = await new TravelAgencyService(locals.supabase).update(params.id, parsed.data);
    return json(agency);
  } catch (error) {
    if (error instanceof TravelAgencyNotFoundError) return json({ error: error.message }, 404);
    if (error instanceof DuplicateNipError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** PATCH /api/travel-agencies/[id] — `{ archived: boolean }` archives or restores. Staff-only. */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  const read = await readJson(request);
  if (!read.ok) return json({ error: "Request body must be valid JSON" }, 400);

  const parsed = archiveTravelAgencySchema.safeParse(read.body);
  if (!parsed.success) return json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  try {
    const agency = await new TravelAgencyService(locals.supabase).setArchived(params.id, parsed.data.archived);
    return json(agency);
  } catch (error) {
    if (error instanceof TravelAgencyNotFoundError) return json({ error: error.message }, 404);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};

/** DELETE /api/travel-agencies/[id] — only while nothing references the agency (else 409). Staff-only. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!params.id || !uuidSchema.safeParse(params.id).success) return json({ error: "Invalid travel agency ID" }, 400);

  try {
    await new TravelAgencyService(locals.supabase).delete(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof TravelAgencyNotFoundError) return json({ error: error.message }, 404);
    if (error instanceof TravelAgencyInUseError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : "An unexpected error occurred" }, 500);
  }
};
