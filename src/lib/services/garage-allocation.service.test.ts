import { describe, expect, it, vi } from "vitest";
import { GarageAllocationService, GarageBufferViolationError, respectsBuffer } from "./garage-allocation.service";

describe("respectsBuffer", () => {
  const window = (checkIn: string, checkOut: string) => ({ checkIn: new Date(checkIn), checkOut: new Date(checkOut) });

  it("allows a candidate that starts exactly 10h after the existing checkout", () => {
    const existing = window("2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z");
    const candidate = window("2026-09-01T18:00:00Z", "2026-09-02T08:00:00Z");
    expect(respectsBuffer(candidate, existing)).toBe(true);
  });

  it("rejects a candidate that starts 9h59m after the existing checkout", () => {
    const existing = window("2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z");
    const candidate = window("2026-09-01T17:59:00Z", "2026-09-02T08:00:00Z");
    expect(respectsBuffer(candidate, existing)).toBe(false);
  });

  it("allows a candidate that ends exactly 10h before the existing check-in", () => {
    const existing = window("2026-09-02T00:00:00Z", "2026-09-02T08:00:00Z");
    const candidate = window("2026-09-01T06:00:00Z", "2026-09-01T14:00:00Z");
    expect(respectsBuffer(candidate, existing)).toBe(true);
  });

  it("rejects an overlapping candidate", () => {
    const existing = window("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    const candidate = window("2026-09-01T12:00:00Z", "2026-09-01T18:00:00Z");
    expect(respectsBuffer(candidate, existing)).toBe(false);
  });
});

/** Minimal Supabase query-builder mock: each `from()` call gets its own canned response. */
function mockSupabase(responses: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(responses[`${table}:single`] ?? { data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue(responses[`${table}:maybeSingle`] ?? { data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve),
    };
    return chain;
  });
  return { from };
}

describe("GarageAllocationService.assign", () => {
  it("creates the assignment when the buffer is respected", async () => {
    const supabase = mockSupabase({
      "reservations:single": {
        data: { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" },
        error: null,
      },
      garage_assignments: { data: [], error: null }, // no active assignments on the spot
      "garage_assignments:single": {
        data: { id: "a1", reservation_id: "r1", garage_spot_id: "s1", assigned_by: "system" },
        error: null,
      },
    });
    const service = new GarageAllocationService(supabase as never);

    const result = await service.assign("r1", "s1", "system");
    expect(result).toMatchObject({ id: "a1" });
  });

  it("throws GarageBufferViolationError when an active assignment violates the buffer", async () => {
    const supabase = mockSupabase({
      "reservations:single": {
        data: { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" },
        error: null,
      },
      // An existing active assignment ending just 1h before the candidate starts — violates the 10h buffer.
      garage_assignments: {
        data: [
          { reservations: { planned_check_in: "2026-09-01T15:00:00Z", planned_check_out: "2026-09-01T23:00:00Z" } },
        ],
        error: null,
      },
    });
    const service = new GarageAllocationService(supabase as never);

    await expect(service.assign("r1", "s1", "system")).rejects.toBeInstanceOf(GarageBufferViolationError);
  });
});

describe("GarageAllocationService.swap", () => {
  it("supersedes the prior assignment and re-validates the buffer for the new spot", async () => {
    const supabase = mockSupabase({
      "garage_assignments:maybeSingle": { data: { id: "old-assignment" }, error: null },
      "reservations:single": {
        data: { planned_check_in: "2026-09-02T00:00:00Z", planned_check_out: "2026-09-02T08:00:00Z" },
        error: null,
      },
      garage_assignments: { data: [], error: null }, // new spot has no conflicting active assignments
      "garage_assignments:single": {
        data: { id: "a2", reservation_id: "r1", garage_spot_id: "s2", assigned_by: "staff" },
        error: null,
      },
    });
    const service = new GarageAllocationService(supabase as never);

    const result = await service.swap("r1", "s2");
    expect(result).toMatchObject({ id: "a2", garage_spot_id: "s2" });
    expect(supabase.from).toHaveBeenCalledWith("garage_assignments");
  });
});
