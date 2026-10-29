import { describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./garage-assignments";

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    request: { json: async () => ({}) },
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/garage-assignments", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await GET(makeCtx());
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/garage-assignments", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await PATCH(makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 400 when reservationId/garageSpotId are missing or wrong type", async () => {
    const res = await PATCH(
      makeCtx({
        locals: { user: { id: "u1" }, supabase: {} },
        request: { json: async () => ({ reservationId: "r1" }) },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when the swap would violate the 10h buffer", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // no prior assignment to supersede
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "GARAGE_BUFFER_VIOLATION" } }),
    };

    const res = await PATCH(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        request: {
          json: async () => ({
            reservationId: "11111111-1111-4111-8111-111111111111",
            garageSpotId: "22222222-2222-4222-8222-222222222222",
          }),
        },
      })
    );
    expect(res.status).toBe(409);
  });
});
