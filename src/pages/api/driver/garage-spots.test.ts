import { describe, expect, it, vi } from "vitest";
import * as endpoint from "./garage-spots";

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    url: new URL("http://localhost/api/driver/garage-spots"),
    ...overrides,
  } as unknown as Parameters<typeof endpoint.GET>[0];
}

describe("GET /api/driver/garage-spots", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await endpoint.GET(makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns the spot list for a driver", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [{ id: "s1", name: "Garaż 1" }], error: null }),
      }),
    };
    const res = await endpoint.GET(makeCtx({ locals: { user: { id: "d1", role: "driver" }, supabase } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "s1", name: "Garaż 1" }]);
  });

  it("is read-only — exposes no write handlers", () => {
    expect("POST" in endpoint || "PATCH" in endpoint || "DELETE" in endpoint).toBe(false);
  });
});
