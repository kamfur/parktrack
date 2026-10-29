import { describe, expect, it, vi } from "vitest";

const swap = vi.fn();
vi.mock("../../../lib/supabase-admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("../../../lib/services/garage-allocation.service", () => ({
  GarageBufferViolationError: class GarageBufferViolationError extends Error {},
  GarageAllocationService: vi.fn(function () {
    return { swap };
  }),
}));

import { PATCH } from "./garage-assignments";
import { GarageBufferViolationError } from "../../../lib/services/garage-allocation.service";

const RES = "11111111-1111-4111-8111-111111111111";
const SPOT = "22222222-2222-4222-8222-222222222222";

function ctx(body: unknown, user: unknown = { id: "d1", role: "driver" }) {
  return { locals: { user }, request: { json: async () => body } } as unknown as Parameters<typeof PATCH>[0];
}

describe("PATCH /api/driver/garage-assignments", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await PATCH(ctx({}, null))).status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    expect((await PATCH(ctx({ reservationId: "x" }))).status).toBe(400);
  });

  it("swaps the assignment for a driver", async () => {
    swap.mockResolvedValueOnce({ id: "a1" });
    const res = await PATCH(ctx({ reservationId: RES, garageSpotId: SPOT }));
    expect(res.status).toBe(200);
    expect(swap).toHaveBeenCalledWith(RES, SPOT, { skipBuffer: undefined });
  });

  it("returns 409 on a buffer violation", async () => {
    swap.mockRejectedValueOnce(new GarageBufferViolationError("bufor"));
    expect((await PATCH(ctx({ reservationId: RES, garageSpotId: SPOT }))).status).toBe(409);
  });
});
