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
