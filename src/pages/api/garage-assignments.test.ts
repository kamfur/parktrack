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
      from: vi.fn((table: string) => {
        if (table === "garage_assignments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({
                data: [
                  {
                    reservations: {
                      planned_check_in: "2026-09-01T00:00:00Z",
                      planned_check_out: "2026-09-01T08:00:00Z",
                    },
                  },
                ],
                error: null,
              }).then(resolve),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { planned_check_in: "2026-09-01T09:00:00Z", planned_check_out: "2026-09-01T12:00:00Z" },
            error: null,
          }),
        };
      }),
    };

    const res = await PATCH(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        request: { json: async () => ({ reservationId: "r1", garageSpotId: "s1" }) },
      })
    );
    expect(res.status).toBe(409);
  });
});
