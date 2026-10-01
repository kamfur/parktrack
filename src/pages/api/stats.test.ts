import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { GET, getWarsawPeriodBounds } from "./stats";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";

describe("GET /api/stats — admin-client 503 guard", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null);
  });

  it("returns 503 when admin client is unavailable", async () => {
    const ctx = {
      url: new URL("http://localhost/api/stats?period=month"),
    } as unknown as Parameters<typeof GET>[0];
    const res = await GET(ctx);
    expect(res.status).toBe(503);
  });
});

describe("getWarsawPeriodBounds — Warsaw timezone boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves CEST offset (+02:00) in summer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00Z")); // Aug 15 12:00 Warsaw (CEST)
    const { start, end } = getWarsawPeriodBounds("month");
    expect(start).toBe("2026-08-01T00:00:00+02:00");
    expect(end).toBe("2026-09-01T00:00:00+02:00");
  });

  it("resolves CET offset (+01:00) in winter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z")); // Jan 15 11:00 Warsaw (CET)
    const { start, end } = getWarsawPeriodBounds("month");
    expect(start).toBe("2026-01-01T00:00:00+01:00");
    expect(end).toBe("2026-02-01T00:00:00+01:00");
  });

  it("counts a UTC/Warsaw month-boundary checkout in the correct Warsaw month", () => {
    vi.useFakeTimers();
    // 2026-09-30T22:00:00Z = 2026-10-01T00:00:00+02:00 (Warsaw, CEST)
    vi.setSystemTime(new Date("2026-09-30T22:00:00Z"));
    const { start } = getWarsawPeriodBounds("month");
    expect(start).toBe("2026-10-01T00:00:00+02:00");
  });
});

describe("GET /api/stats — reservations count and garage occupancy", () => {
  // Chainable query-builder stub: every filter returns itself, awaiting resolves to `result`.
  function query(result: unknown) {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "gte", "lt", "not", "is"]) builder[m] = () => builder;
    builder.maybeSingle = () => Promise.resolve(result);
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  }

  it("counts distinct occupied garage spots against available spots", async () => {
    // Order mirrors the Promise.all in the handler.
    const results = [
      { count: 2, error: null }, // arrivals
      { count: 1, error: null }, // departures
      { count: 5, error: null }, // parking occupancy
      { data: { value: "10" }, error: null }, // settings
      { data: [], error: null }, // revenue
      { count: 7, error: null }, // new reservations
      { count: 4, error: null }, // available garage spots
      { data: [{ garage_spot_id: "a" }, { garage_spot_id: "b" }, { garage_spot_id: "a" }], error: null },
    ];
    let call = 0;
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: () => query(results[call++]),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const ctx = { url: new URL("http://localhost/api/stats?period=day") } as unknown as Parameters<typeof GET>[0];
    const body = await (await GET(ctx)).json();

    expect(body).toMatchObject({
      reservationsCount: 7,
      garageOccupiedSpots: 2,
      garageTotalSpots: 4,
      garageOccupancyPct: 50,
    });
  });
});
