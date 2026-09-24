import { describe, expect, it, vi, afterEach } from "vitest";
import {
  handledWindowStartIso,
  isOnOrBeforeWarsawToday,
  startOfTomorrowWarsawIso,
  startOfWarsawTodayIso,
  warsawDateKey,
} from "./operating-window";

describe("operating-window", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes same-day late arrival (planned 08:00, now 12:00 Warsaw)", () => {
    // 2026-09-09 12:00 Warsaw (CEST = UTC+2) → 10:00Z
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    // planned 08:00 Warsaw → 06:00Z
    expect(isOnOrBeforeWarsawToday("2026-09-09T06:00:00.000Z")).toBe(true);
  });

  it("includes yesterday overdue", () => {
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    expect(isOnOrBeforeWarsawToday("2026-09-08T06:00:00.000Z")).toBe(true);
  });

  it("excludes tomorrow", () => {
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    expect(isOnOrBeforeWarsawToday("2026-09-10T06:00:00.000Z")).toBe(false);
  });

  it("startOfTomorrowWarsawIso excludes tomorrow midnight Warsaw and later", () => {
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    const bound = startOfTomorrowWarsawIso();
    // 2026-09-10 00:00 Warsaw = 2026-09-09 22:00Z
    expect(new Date("2026-09-09T21:59:59.000Z").toISOString() < bound).toBe(true);
    expect(new Date("2026-09-09T22:00:00.000Z").toISOString() < bound).toBe(false);
  });

  it("warsawDateKey formats in Europe/Warsaw", () => {
    // 2026-09-09 22:30Z = 2026-09-10 00:30 Warsaw
    expect(warsawDateKey(new Date("2026-09-09T22:30:00Z"))).toBe("2026-09-10");
  });

  it("startOfWarsawTodayIso is midnight Warsaw", () => {
    vi.setSystemTime(new Date("2026-09-09T10:00:00Z"));
    expect(startOfWarsawTodayIso()).toBe("2026-09-08T22:00:00.000Z");
  });

  it("handled window in the evening starts at Warsaw midnight (full calendar day)", () => {
    const now = new Date("2026-09-09T18:00:00Z"); // 20:00 Warsaw
    expect(handledWindowStartIso(now)).toBe("2026-09-08T22:00:00.000Z");
  });

  it("handled window before noon starts 12h ago (overnight lookback)", () => {
    const now = new Date("2026-09-09T00:00:00Z"); // 02:00 Warsaw
    expect(handledWindowStartIso(now)).toBe("2026-09-08T12:00:00.000Z");
  });
});
