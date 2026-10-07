import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  AnalyticsAgencyItem,
  AnalyticsBreakdownItem,
  AnalyticsData,
  AnalyticsGranularity,
  AnalyticsOccupancyPoint,
  AnalyticsRevenuePoint,
} from "../../types";
import { addUtcDays, dateKeysInRange, warsawDateKey, warsawDayBounds } from "../calendar/warsaw-time";

export class AnalyticsServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = "AnalyticsServiceError";
  }
}

const PAGE_SIZE = 1000;
const DEFAULT_TOTAL_SPOTS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const REVENUE_SELECT =
  "total_cost, surcharge_amount, paid_at_arrival, paid_at_departure, travel_agency_id, actual_check_in, actual_check_out";
const BOOKING_SELECT =
  "status, planned_check_in, planned_check_out, actual_check_in, actual_check_out, parking_type, source, travel_agency_id";

export interface RevenueRow {
  total_cost: number | string | null;
  surcharge_amount: number | string | null;
  paid_at_arrival: boolean | null;
  paid_at_departure: boolean | null;
  travel_agency_id: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
}

export interface BookingRow {
  status: string;
  planned_check_in: string;
  planned_check_out: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  parking_type: string;
  source: string;
  travel_agency_id: string | null;
}

type Client = SupabaseClient<Database>;

function inRange(iso: string | null, startMs: number, endMs: number): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return ms >= startMs && ms < endMs;
}

/**
 * Moment, w którym przychód z rezerwacji jest księgowany. Ta sama reguła co kafelek „Przychód"
 * w /api/stats: opłacone przy przyjeździe lub biuro podróży → faktyczny przyjazd;
 * w przeciwnym razie opłacone przy wyjeździe → faktyczny wyjazd. Zwraca null, gdy poza zakresem.
 */
export function revenueEventAt(row: RevenueRow, startMs: number, endMs: number): string | null {
  const arrivalCounted =
    (row.paid_at_arrival === true || row.travel_agency_id != null) && inRange(row.actual_check_in, startMs, endMs);
  if (arrivalCounted) return row.actual_check_in;
  if (row.paid_at_arrival !== true && row.paid_at_departure === true && inRange(row.actual_check_out, startMs, endMs)) {
    return row.actual_check_out;
  }
  return null;
}

export function bucketKey(dateKey: string, granularity: AnalyticsGranularity): string {
  return granularity === "month" ? dateKey.slice(0, 7) : dateKey;
}

function orderedBuckets(dateKeys: string[], granularity: AnalyticsGranularity): string[] {
  return [...new Set(dateKeys.map((key) => bucketKey(key, granularity)))];
}

export function buildRevenueSeries(
  rows: RevenueRow[],
  startMs: number,
  endMs: number,
  dateKeys: string[],
  granularity: AnalyticsGranularity
): { total: number; count: number; series: AnalyticsRevenuePoint[] } {
  const sums = new Map(orderedBuckets(dateKeys, granularity).map((bucket) => [bucket, 0]));
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const at = revenueEventAt(row, startMs, endMs);
    if (!at) continue;
    const amount = (Number(row.total_cost) || 0) + (Number(row.surcharge_amount) || 0);
    const bucket = bucketKey(warsawDateKey(new Date(at)), granularity);
    sums.set(bucket, (sums.get(bucket) ?? 0) + amount);
    total += amount;
    count += 1;
  }
  return {
    total: round2(total),
    count,
    series: [...sums].map(([bucket, revenue]) => ({ bucket, revenue: round2(revenue) })),
  };
}

function stayWindow(row: BookingRow): { startMs: number; endMs: number } {
  return {
    startMs: Date.parse(row.actual_check_in ?? row.planned_check_in),
    endMs: Date.parse(row.actual_check_out ?? row.planned_check_out),
  };
}

export function buildOccupancySeries(
  rows: BookingRow[],
  dateKeys: string[],
  granularity: AnalyticsGranularity,
  totalSpots: number,
  todayKey: string
): AnalyticsOccupancyPoint[] {
  const windows = rows.map((row) => ({ ...stayWindow(row), confirmed: row.status === "confirmed" }));
  const perBucket = new Map<string, { sum: number; days: number; firstKey: string }>();

  for (const key of dateKeys) {
    const { start, end } = warsawDayBounds(key);
    const dayStart = Date.parse(start);
    const dayEnd = Date.parse(end);
    // Past days count cars that actually stayed; unconfirmed bookings only count from today on.
    const occupied = windows.filter(
      (w) => w.startMs < dayEnd && w.endMs > dayStart && (!w.confirmed || key >= todayKey)
    ).length;
    const bucket = bucketKey(key, granularity);
    const entry = perBucket.get(bucket) ?? { sum: 0, days: 0, firstKey: key };
    entry.sum += occupied;
    entry.days += 1;
    perBucket.set(bucket, entry);
  }

  return [...perBucket].map(([bucket, { sum, days, firstKey }]) => {
    const occupied = Math.round((sum / days) * 10) / 10;
    return {
      bucket,
      occupied,
      occupancyPct: Math.round((occupied / totalSpots) * 100),
      forecast: firstKey > todayKey,
    };
  });
}

function tally(keys: string[], order?: string[]): AnalyticsBreakdownItem[] {
  const counts = new Map<string, number>(order?.map((key) => [key, 0]));
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count }));
}

const STAY_LENGTH_BUCKETS = ["1-3", "4-7", "8-14", "15+"];

function stayLengthBucket(row: BookingRow): string {
  const { startMs, endMs } = stayWindow(row);
  const days = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
  if (days <= 3) return "1-3";
  if (days <= 7) return "4-7";
  if (days <= 14) return "8-14";
  return "15+";
}

/** Rozkłady dla rezerwacji, których pobyt zaczyna się w zakresie (bez anulowanych i no-show). */
export function buildBreakdown(rows: BookingRow[], startMs: number, endMs: number): AnalyticsData["breakdown"] {
  const starting = rows.filter((row) => inRange(row.actual_check_in ?? row.planned_check_in, startMs, endMs));
  return {
    parkingType: tally(starting.map((row) => row.parking_type)),
    source: tally(starting.map((row) => row.source)),
    customerType: tally(
      starting.map((row) => (row.travel_agency_id ? "agency" : "individual")),
      ["individual", "agency"]
    ),
    stayLength: tally(starting.map(stayLengthBucket), STAY_LENGTH_BUCKETS),
  };
}

export interface StatusRow {
  status: string;
}

export interface MoneyRow {
  total_cost: number | string | null;
  surcharge_amount: number | string | null;
}

export interface AgencyStayRow extends MoneyRow {
  travel_agency_id: string | null;
  travel_agencies: { name: string } | null;
}

const TOP_AGENCIES_LIMIT = 5;

const amountOf = (row: MoneyRow): number => (Number(row.total_cost) || 0) + (Number(row.surcharge_amount) || 0);

const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

export function buildQuality(rows: StatusRow[]): AnalyticsData["quality"] {
  const cancelled = rows.filter((row) => row.status === "cancelled").length;
  const noShow = rows.filter((row) => row.status === "no_show").length;
  return {
    total: rows.length,
    cancelled,
    noShow,
    cancelledPct: pct(cancelled, rows.length),
    noShowPct: pct(noShow, rows.length),
  };
}

export function buildReceivables(rows: MoneyRow[]): AnalyticsData["receivables"] {
  return { count: rows.length, amount: round2(rows.reduce((sum, row) => sum + amountOf(row), 0)) };
}

export function buildTopAgencies(rows: AgencyStayRow[]): AnalyticsAgencyItem[] {
  const byAgency = new Map<string, AnalyticsAgencyItem>();
  for (const row of rows) {
    if (!row.travel_agency_id) continue;
    const entry = byAgency.get(row.travel_agency_id) ?? {
      id: row.travel_agency_id,
      name: row.travel_agencies?.name ?? "—",
      stays: 0,
      revenue: 0,
    };
    entry.stays += 1;
    entry.revenue += amountOf(row);
    byAgency.set(row.travel_agency_id, entry);
  }
  return [...byAgency.values()]
    .map((item) => ({ ...item, revenue: round2(item.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_AGENCIES_LIMIT);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseTotalSpots(value: unknown): number {
  const parsed = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return value == null || Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_TOTAL_SPOTS : parsed;
}

export class AnalyticsService {
  constructor(private readonly supabase: Client) {}

  async getAnalytics(from: string, to: string, granularity: AnalyticsGranularity): Promise<AnalyticsData> {
    const start = warsawDayBounds(from).start;
    const end = warsawDayBounds(to).end;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    const dateKeys = dateKeysInRange(start, end);

    const days = dateKeys.length;
    const prevFrom = addUtcDays(from, -days);
    const prevStart = warsawDayBounds(prevFrom).start;
    const prevStartMs = Date.parse(prevStart);

    const [revenueRows, previousRevenueRows, bookings, statusRows, unpaidRows, agencyRows, spotsResult] =
      await Promise.all([
        this.fetchRevenueRows(start, end),
        this.fetchRevenueRows(prevStart, start),
        this.fetchBookings(start, end),
        this.fetchAll<StatusRow>((lo, hi) =>
          this.supabase
            .from("reservations")
            .select("status")
            .gte("planned_check_in", start)
            .lt("planned_check_in", end)
            .order("id")
            .range(lo, hi)
        ),
        this.fetchAll<MoneyRow>((lo, hi) =>
          this.supabase
            .from("reservations")
            .select("total_cost, surcharge_amount")
            .eq("status", "completed")
            .eq("is_paid", false)
            .is("travel_agency_id", null)
            .gte("actual_check_in", start)
            .lt("actual_check_in", end)
            .order("id")
            .range(lo, hi)
        ),
        this.fetchAll<AgencyStayRow>((lo, hi) =>
          this.supabase
            .from("reservations")
            .select("total_cost, surcharge_amount, travel_agency_id, travel_agencies(name)")
            .not("travel_agency_id", "is", null)
            .gte("actual_check_in", start)
            .lt("actual_check_in", end)
            .order("id")
            .range(lo, hi)
        ),
        this.supabase.from("settings").select("value").eq("key", "total_parking_spots").maybeSingle(),
      ]);
    if (spotsResult.error) throw new AnalyticsServiceError(`Settings: ${spotsResult.error.message}`);

    const totalSpots = parseTotalSpots(spotsResult.data?.value);
    const current = buildRevenueSeries(revenueRows, startMs, endMs, dateKeys, granularity);
    const previous = buildRevenueSeries(previousRevenueRows, prevStartMs, startMs, [], granularity);

    const occupancySeries = buildOccupancySeries(
      bookings,
      dateKeys,
      granularity,
      totalSpots,
      warsawDateKey(new Date())
    );

    return {
      range: { from, to, granularity },
      revenue: {
        total: current.total,
        previousTotal: previous.total,
        changePct: previous.total > 0 ? Math.round(((current.total - previous.total) / previous.total) * 100) : null,
        avgPerReservation: current.count > 0 ? round2(current.total / current.count) : 0,
        avgPerDay: round2(current.total / days),
        series: current.series,
      },
      occupancy: {
        totalSpots,
        peakPct: occupancySeries.reduce((max, point) => Math.max(max, point.occupancyPct), 0),
        series: occupancySeries,
      },
      quality: buildQuality(statusRows),
      receivables: buildReceivables(unpaidRows),
      topAgencies: buildTopAgencies(agencyRows),
      breakdown: buildBreakdown(bookings, startMs, endMs),
    };
  }

  private async fetchRevenueRows(start: string, end: string): Promise<RevenueRow[]> {
    return this.fetchAll<RevenueRow>((lo, hi) =>
      this.supabase
        .from("reservations")
        .select(REVENUE_SELECT)
        .or(
          `and(paid_at_arrival.eq.true,actual_check_in.gte.${start},actual_check_in.lt.${end}),` +
            `and(paid_at_arrival.eq.false,paid_at_departure.eq.true,actual_check_out.gte.${start},actual_check_out.lt.${end}),` +
            `and(travel_agency_id.not.is.null,actual_check_in.gte.${start},actual_check_in.lt.${end})`
        )
        .order("id")
        .range(lo, hi)
    );
  }

  /** Rezerwacje (bez anulowanych i no-show) z pobytem zachodzącym na zakres; trwające liczone zawsze. */
  private async fetchBookings(start: string, end: string): Promise<BookingRow[]> {
    return this.fetchAll<BookingRow>((lo, hi) =>
      this.supabase
        .from("reservations")
        .select(BOOKING_SELECT)
        .in("status", ["confirmed", "in_progress", "completed"])
        .lt("planned_check_in", end)
        .or(`planned_check_out.gt.${start},status.eq.in_progress`)
        .order("id")
        .range(lo, hi)
    );
  }

  private async fetchAll<T>(
    page: (lo: number, hi: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let lo = 0; ; lo += PAGE_SIZE) {
      const { data, error } = await page(lo, lo + PAGE_SIZE - 1);
      if (error) throw new AnalyticsServiceError(error.message);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  }
}
