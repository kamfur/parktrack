import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";

export const prerender = false;

const querySchema = z.object({
  period: z.enum(["day", "month"]).default("day"),
});

function getWarsawPeriodBounds(period: "day" | "month"): {
  start: string;
  end: string;
} {
  const now = new Date();
  // Resolve current Warsaw UTC offset dynamically (handles CET/CEST DST)
  const tzPart =
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Warsaw",
      timeZoneName: "shortOffset",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = match?.[1] ?? "+";
  const hh = String(match?.[2] ?? "2").padStart(2, "0");
  const mm = String(match?.[3] ?? "0").padStart(2, "0");
  const tz = `${sign}${hh}:${mm}`;

  const warsawDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(now);
  const [year, month, day] = warsawDate.split("-").map(Number);

  if (period === "day") {
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const nextDayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
    }).format(nextDay);
    return {
      start: `${warsawDate}T00:00:00${tz}`,
      end: `${nextDayStr}T00:00:00${tz}`,
    };
  }

  const monthStr = String(month).padStart(2, "0");
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = String(nextMonth).padStart(2, "0");
  return {
    start: `${year}-${monthStr}-01T00:00:00${tz}`,
    end: `${nextYear}-${nextMonthStr}-01T00:00:00${tz}`,
  };
}

export const GET: APIRoute = async ({ url }) => {
  const rawPeriod = url.searchParams.get("period");
  const parseResult = querySchema.safeParse(rawPeriod != null ? { period: rawPeriod } : {});
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: "Invalid period. Use 'day' or 'month'." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { period } = parseResult.data;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return new Response(
      JSON.stringify({
        error: "Admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY env var",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { start, end } = getWarsawPeriodBounds(period);

  try {
    const [arrivalsResult, departuresResult, occupancyResult, settingsResult, revenueResult] = await Promise.all([
      // Arrivals: day=confirmed with check-in today; month=all check-ins this month
      period === "day"
        ? supabase
            .from("reservations")
            .select("*", { count: "exact", head: true })
            .eq("status", "confirmed")
            .gte("planned_check_in", start)
            .lt("planned_check_in", end)
        : supabase
            .from("reservations")
            .select("*", { count: "exact", head: true })
            .gte("planned_check_in", start)
            .lt("planned_check_in", end),

      // Departures: day=in_progress with check-out today; month=all check-outs this month
      period === "day"
        ? supabase
            .from("reservations")
            .select("*", { count: "exact", head: true })
            .eq("status", "in_progress")
            .gte("planned_check_out", start)
            .lt("planned_check_out", end)
        : supabase
            .from("reservations")
            .select("*", { count: "exact", head: true })
            .gte("planned_check_out", start)
            .lt("planned_check_out", end),

      // Occupancy: always current regardless of period
      supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "in_progress"),

      // Total parking spots from settings
      supabase.from("settings").select("value").eq("key", "total_parking_spots").maybeSingle(),

      // Revenue: completed reservations with actual_check_out in period
      supabase
        .from("reservations")
        .select("total_cost")
        .eq("status", "completed")
        .not("actual_check_out", "is", null)
        .gte("actual_check_out", start)
        .lt("actual_check_out", end),
    ]);

    if (arrivalsResult.error) throw new Error(`Arrivals: ${arrivalsResult.error.message}`);
    if (departuresResult.error) throw new Error(`Departures: ${departuresResult.error.message}`);
    if (occupancyResult.error) throw new Error(`Occupancy: ${occupancyResult.error.message}`);
    if (revenueResult.error) throw new Error(`Revenue: ${revenueResult.error.message}`);

    const arrivalsCount = arrivalsResult.count ?? 0;
    const departuresCount = departuresResult.count ?? 0;
    const occupied = occupancyResult.count ?? 0;

    const settingsValue = settingsResult.data?.value;
    const rawTotalSpots =
      settingsValue != null
        ? typeof settingsValue === "string"
          ? parseInt(settingsValue, 10)
          : Number(settingsValue)
        : 100;
    const totalSpots = isNaN(rawTotalSpots) || rawTotalSpots <= 0 ? 100 : rawTotalSpots;

    const occupancyPct = Math.round((occupied / totalSpots) * 100);
    const freeSpots = Math.max(0, totalSpots - occupied);

    const revenue = (revenueResult.data ?? []).reduce((sum, row) => sum + (Number(row.total_cost) || 0), 0);
    const roundedRevenue = Math.round(revenue * 100) / 100;

    return new Response(
      JSON.stringify({
        arrivalsCount,
        departuresCount,
        occupancyPct,
        freeSpots,
        totalSpots,
        revenue: roundedRevenue,
        period,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stats API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
