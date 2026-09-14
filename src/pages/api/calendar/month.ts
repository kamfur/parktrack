import type { APIRoute } from "astro";
import { calendarRangeQuerySchema } from "../../../lib/schemas/calendar.schema";
import { CalendarService, CalendarServiceError } from "../../../lib/services/calendar.service";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const validation = calendarRangeQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!validation.success) return json({ error: "Validation failed", details: validation.error.format() }, 400);
  if (validation.data.view !== "month") return json({ error: "view must be month" }, 400);

  try {
    const days = await new CalendarService(locals.supabase).listMonthCounts(validation.data.from, validation.data.to);
    return json({ data: days });
  } catch (error) {
    if (error instanceof CalendarServiceError) return json({ error: error.message }, error.statusCode);
    return json({ error: "An unexpected error occurred" }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
