import type { APIRoute } from "astro";
import { analyticsQuerySchema } from "../../../lib/schemas/analytics.schema";
import { AnalyticsService, AnalyticsServiceError } from "../../../lib/services/analytics.service";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const validation = analyticsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!validation.success) return json({ error: "Validation failed", details: validation.error.format() }, 400);

  try {
    const { from, to, granularity } = validation.data;
    const data = await new AnalyticsService(locals.supabase).getAnalytics(from, to, granularity);
    return json({ data });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) return json({ error: error.message }, error.statusCode);
    // eslint-disable-next-line no-console
    console.error("Analytics API error:", error);
    return json({ error: "An unexpected error occurred" }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
