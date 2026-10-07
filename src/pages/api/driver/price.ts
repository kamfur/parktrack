import type { APIRoute } from "astro";
import { z } from "zod";
import { PARKING_TYPES } from "../../../lib/pricing/parking-type";
import { MAX_VEHICLE_COUNT } from "../../../lib/vehicles";
import { NoPriceListError, ReservationService } from "../../../lib/services/reservation.service";

export const prerender = false;

const querySchema = z
  .object({
    check_in: z.string().datetime({ offset: true }),
    check_out: z.string().datetime({ offset: true }),
    parking_type: z.enum(PARKING_TYPES).default("open_air"),
    vehicle_count: z.coerce.number().int().min(1).max(MAX_VEHICLE_COUNT).default(1),
  })
  .refine((q) => Date.parse(q.check_out) > Date.parse(q.check_in), { path: ["check_out"] });

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * GET /api/driver/price?check_in=&check_out=&parking_type=&vehicle_count= — price-list preview for the
 * driver's new-reservation form (`/api/calculate-cost` is staff-only).
 */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!locals.supabase) return json({ error: "Service unavailable" }, 503);

  const parsed = querySchema.safeParse({
    check_in: url.searchParams.get("check_in"),
    check_out: url.searchParams.get("check_out"),
    parking_type: url.searchParams.get("parking_type") ?? undefined,
    vehicle_count: url.searchParams.get("vehicle_count") ?? undefined,
  });
  if (!parsed.success) return json({ error: "Validation failed" }, 400);

  try {
    const { check_in, check_out, parking_type, vehicle_count } = parsed.data;
    const perCar = await new ReservationService(locals.supabase).calculateCost(check_in, check_out, parking_type);
    return json({ total_cost: perCar * vehicle_count }, 200);
  } catch (error) {
    if (error instanceof NoPriceListError) {
      return json({ error: "Brak cennika obejmującego datę przyjazdu" }, 422);
    }
    return json({ error: "Nie udało się przeliczyć ceny" }, 500);
  }
};
