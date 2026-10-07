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
function mockSupabase(responses: Record<string, unknown>, rpcResponse?: unknown) {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
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
  const rpc = vi.fn().mockResolvedValue(rpcResponse ?? { data: null, error: null });
  return { from, rpc };
}

describe("GarageAllocationService.assign", () => {
  it("calls the assign_garage_spot RPC and returns the created assignment", async () => {
    const supabase = mockSupabase(
      {},
      { data: { id: "a1", reservation_id: "r1", garage_spot_id: "s1", assigned_by: "system" }, error: null }
    );
    const service = new GarageAllocationService(supabase as never);

    const result = await service.assign("r1", "s1", "system");

    expect(supabase.rpc).toHaveBeenCalledWith("assign_garage_spot", {
      p_reservation_id: "r1",
      p_garage_spot_id: "s1",
      p_assigned_by: "system",
    });
    expect(result).toMatchObject({ id: "a1" });
  });

  it("throws GarageBufferViolationError when the RPC reports a buffer violation", async () => {
    const supabase = mockSupabase({}, { data: null, error: { message: "GARAGE_BUFFER_VIOLATION" } });
    const service = new GarageAllocationService(supabase as never);

    await expect(service.assign("r1", "s1", "system")).rejects.toBeInstanceOf(GarageBufferViolationError);
  });
});

describe("GarageAllocationService.swap", () => {
  it("supersedes the prior assignment and re-validates the buffer for the new spot", async () => {
    const supabase = mockSupabase(
      { "garage_assignments:maybeSingle": { data: { id: "old-assignment" }, error: null } },
      { data: { id: "a2", reservation_id: "r1", garage_spot_id: "s2", assigned_by: "staff" }, error: null }
    );
    const service = new GarageAllocationService(supabase as never);

    const result = await service.swap("r1", "s2");
    expect(result).toMatchObject({ id: "a2", garage_spot_id: "s2" });
    expect(supabase.rpc).toHaveBeenCalledWith("assign_garage_spot", {
      p_reservation_id: "r1",
      p_garage_spot_id: "s2",
      p_assigned_by: "staff",
    });
  });
});

describe("GarageAllocationService.revalidateAssignment", () => {
  it("does nothing when the reservation has no active garage assignment", async () => {
    const supabase = mockSupabase({ "garage_assignments:maybeSingle": { data: null, error: null } });
    const service = new GarageAllocationService(supabase as never);

    await expect(
      service.revalidateAssignment("r1", "2026-09-02T00:00:00Z", "2026-09-02T08:00:00Z")
    ).resolves.toBeUndefined();
  });

  it("passes when the new dates still respect the buffer against other assignments on the same spot", async () => {
    const supabase = mockSupabase({
      "garage_assignments:maybeSingle": { data: { garage_spot_id: "s1" }, error: null },
      garage_assignments: { data: [], error: null }, // no other active assignments on the spot
    });
    const service = new GarageAllocationService(supabase as never);

    await expect(
      service.revalidateAssignment("r1", "2026-09-02T00:00:00Z", "2026-09-02T08:00:00Z")
    ).resolves.toBeUndefined();
  });

  it("throws GarageBufferViolationError when the new dates would violate the buffer", async () => {
    const supabase = mockSupabase({
      "garage_assignments:maybeSingle": { data: { garage_spot_id: "s1" }, error: null },
      // Another reservation on the same spot ends just 1h before the new candidate window starts.
      garage_assignments: {
        data: [
          { reservations: { planned_check_in: "2026-09-01T15:00:00Z", planned_check_out: "2026-09-01T23:00:00Z" } },
        ],
        error: null,
      },
    });
    const service = new GarageAllocationService(supabase as never);

    await expect(
      service.revalidateAssignment("r1", "2026-09-02T00:00:00Z", "2026-09-02T08:00:00Z")
    ).rejects.toBeInstanceOf(GarageBufferViolationError);
  });
});

describe("GarageAllocationService.listActiveAssignments", () => {
  const row = (id: string, status: string) => ({
    id,
    garage_spot_id: "s1",
    garage_spots: { name: "G1" },
    reservation_id: `r-${id}`,
    reservations: {
      last_name: "Kowalski",
      planned_check_in: "2026-09-01T00:00:00Z",
      planned_check_out: "2026-09-03T00:00:00Z",
      status,
    },
  });

  it("leaves out reservations that no longer hold a spot (cancelled, no-show, completed)", async () => {
    const supabase = mockSupabase({
      garage_assignments: {
        data: [row("a1", "confirmed"), row("a2", "cancelled"), row("a3", "no_show"), row("a4", "in_progress")],
        error: null,
      },
    });

    const entries = await new GarageAllocationService(supabase as never).listActiveAssignments();

    expect(entries.map((entry) => entry.assignmentId)).toEqual(["a1", "a4"]);
  });
});
