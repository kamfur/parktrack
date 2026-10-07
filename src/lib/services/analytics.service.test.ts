import { describe, expect, it } from "vitest";
import {
  buildBreakdown,
  buildQuality,
  buildReceivables,
  buildTopAgencies,
  buildOccupancySeries,
  buildRevenueSeries,
  revenueEventAt,
  type BookingRow,
  type RevenueRow,
} from "./analytics.service";
import { dateKeysInRange, warsawDayBounds } from "../calendar/warsaw-time";

const START = Date.parse("2026-09-01T00:00:00+02:00");
const END = Date.parse("2026-10-01T00:00:00+02:00");

function revenueRow(overrides: Partial<RevenueRow>): RevenueRow {
  return {
    total_cost: 100,
    surcharge_amount: 0,
    paid_at_arrival: false,
    paid_at_departure: false,
    travel_agency_id: null,
    actual_check_in: null,
    actual_check_out: null,
    ...overrides,
  };
}

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    status: "completed",
    planned_check_in: "2026-09-10T10:00:00+02:00",
    planned_check_out: "2026-09-12T10:00:00+02:00",
    actual_check_in: null,
    actual_check_out: null,
    parking_type: "open_air",
    source: "phone",
    travel_agency_id: null,
    ...overrides,
  };
}

describe("revenueEventAt — same attribution rule as /api/stats", () => {
  it("books paid-at-arrival stays on the actual check-in", () => {
    const row = revenueRow({ paid_at_arrival: true, actual_check_in: "2026-09-05T09:00:00+02:00" });
    expect(revenueEventAt(row, START, END)).toBe("2026-09-05T09:00:00+02:00");
  });

  it("books paid-at-departure stays on the actual check-out", () => {
    const row = revenueRow({ paid_at_departure: true, actual_check_out: "2026-09-20T09:00:00+02:00" });
    expect(revenueEventAt(row, START, END)).toBe("2026-09-20T09:00:00+02:00");
  });

  it("books agency stays on the actual check-in even without driver payment flags", () => {
    const row = revenueRow({ travel_agency_id: "a1", actual_check_in: "2026-09-07T09:00:00+02:00" });
    expect(revenueEventAt(row, START, END)).toBe("2026-09-07T09:00:00+02:00");
  });

  it("ignores events outside the range", () => {
    const row = revenueRow({ paid_at_arrival: true, actual_check_in: "2026-08-31T21:59:00+02:00" });
    expect(revenueEventAt(row, START, END)).toBeNull();
  });

  it("ignores unpaid individual stays", () => {
    expect(revenueEventAt(revenueRow({ actual_check_in: "2026-09-05T09:00:00+02:00" }), START, END)).toBeNull();
  });
});

describe("buildRevenueSeries", () => {
  const keys = dateKeysInRange(warsawDayBounds("2026-09-01").start, warsawDayBounds("2026-09-30").end);

  it("sums cost plus surcharge into daily buckets and zero-fills the rest", () => {
    const rows = [
      revenueRow({ paid_at_arrival: true, actual_check_in: "2026-09-05T09:00:00+02:00", surcharge_amount: 20 }),
      revenueRow({ paid_at_arrival: true, actual_check_in: "2026-09-05T15:00:00+02:00", total_cost: "50.50" }),
    ];
    const result = buildRevenueSeries(rows, START, END, keys, "day");
    expect(result.total).toBe(170.5);
    expect(result.count).toBe(2);
    expect(result.series).toHaveLength(30);
    expect(result.series.find((p) => p.bucket === "2026-09-05")?.revenue).toBe(170.5);
    expect(result.series.find((p) => p.bucket === "2026-09-06")?.revenue).toBe(0);
  });

  it("groups by month", () => {
    const rows = [revenueRow({ paid_at_arrival: true, actual_check_in: "2026-09-05T09:00:00+02:00" })];
    const result = buildRevenueSeries(rows, START, END, keys, "month");
    expect(result.series).toEqual([{ bucket: "2026-09", revenue: 100 }]);
  });
});

describe("buildOccupancySeries", () => {
  const keys = ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"];

  it("counts overlapping stays and marks future days as forecast", () => {
    const rows = [booking({}), booking({ status: "confirmed" })];
    const series = buildOccupancySeries(rows, keys, "day", 10, "2026-09-11");
    expect(series.map((p) => p.occupied)).toEqual([0, 1, 2, 2]);
    expect(series.map((p) => p.forecast)).toEqual([false, false, false, true]);
    expect(series[2].occupancyPct).toBe(20);
  });

  it("does not count unconfirmed bookings on past days", () => {
    const series = buildOccupancySeries([booking({ status: "confirmed" })], keys, "day", 10, "2026-09-12");
    expect(series.map((p) => p.occupied)).toEqual([0, 0, 0, 1]);
  });

  it("averages per month bucket", () => {
    const series = buildOccupancySeries([booking({})], keys, "month", 10, "2026-09-30");
    expect(series).toEqual([{ bucket: "2026-09", occupied: 0.8, occupancyPct: 8, forecast: false }]);
  });
});

describe("buildBreakdown", () => {
  it("tallies stays starting in range by type, source, customer and length", () => {
    const rows = [
      booking({ parking_type: "garage", source: "walk_in", planned_check_out: "2026-09-25T10:00:00+02:00" }),
      booking({ travel_agency_id: "a1" }),
      booking({ planned_check_in: "2026-08-20T10:00:00+02:00" }),
    ];
    const breakdown = buildBreakdown(rows, START, END);
    expect(breakdown.parkingType).toEqual([
      { key: "garage", count: 1 },
      { key: "open_air", count: 1 },
    ]);
    expect(breakdown.customerType).toEqual([
      { key: "individual", count: 1 },
      { key: "agency", count: 1 },
    ]);
    expect(breakdown.stayLength).toEqual([
      { key: "1-3", count: 1 },
      { key: "4-7", count: 0 },
      { key: "8-14", count: 0 },
      { key: "15+", count: 1 },
    ]);
  });
});

describe("buildQuality", () => {
  it("computes cancellation and no-show shares of all bookings", () => {
    const rows = ["completed", "completed", "cancelled", "no_show"].map((status) => ({ status }));
    expect(buildQuality(rows)).toEqual({ total: 4, cancelled: 1, noShow: 1, cancelledPct: 25, noShowPct: 25 });
  });

  it("returns zeros for an empty range", () => {
    expect(buildQuality([])).toEqual({ total: 0, cancelled: 0, noShow: 0, cancelledPct: 0, noShowPct: 0 });
  });
});

describe("buildReceivables", () => {
  it("sums cost plus surcharge of unpaid stays", () => {
    const rows = [
      { total_cost: 100, surcharge_amount: 20 },
      { total_cost: "50.50", surcharge_amount: null },
    ];
    expect(buildReceivables(rows)).toEqual({ count: 2, amount: 170.5 });
  });
});

describe("buildTopAgencies", () => {
  it("groups stays per agency, ranks by revenue and keeps the top five", () => {
    const stay = (id: string, name: string, cost: number) => ({
      total_cost: cost,
      surcharge_amount: 0,
      travel_agency_id: id,
      travel_agencies: { name },
    });
    const rows = [
      stay("a", "Alfa", 100),
      stay("b", "Beta", 500),
      stay("a", "Alfa", 150),
      ...["c", "d", "e", "f"].map((id, i) => stay(id, id.toUpperCase(), 10 + i)),
    ];
    const top = buildTopAgencies(rows);
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ id: "b", name: "Beta", stays: 1, revenue: 500 });
    expect(top[1]).toEqual({ id: "a", name: "Alfa", stays: 2, revenue: 250 });
  });
});
