import { describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH } from "./garage-spots";

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    request: { json: async () => ({}) },
    url: new URL("http://localhost/api/garage-spots"),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/garage-spots", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await GET(makeCtx());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("returns the spot list for an authenticated request", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [{ id: "s1", name: "Garaż 1" }], error: null }),
      }),
    };
    const res = await GET(makeCtx({ locals: { user: { id: "u1" }, supabase } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "s1", name: "Garaż 1" }]);
  });
});

describe("POST /api/garage-spots", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await POST(makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid input (zod validation)", async () => {
    const supabase = { from: vi.fn() };
    const res = await POST(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        request: { json: async () => ({ name: "", spot_type: "shed" }) },
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a spot on valid input", async () => {
    const created = { id: "s1", name: "Garaż 1", spot_type: "garage", capacity_label: "single" };
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    };
    const res = await POST(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        request: {
          json: async () => ({ name: "Garaż 1", spot_type: "garage", capacity_label: "single" }),
        },
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });
});

describe("PATCH /api/garage-spots", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await PATCH(makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 400 when the id query parameter is missing", async () => {
    const res = await PATCH(makeCtx({ locals: { user: { id: "u1" }, supabase: {} } }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the spot does not exist", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } }),
      }),
    };
    const res = await PATCH(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        url: new URL("http://localhost/api/garage-spots?id=11111111-1111-4111-8111-111111111111"),
        request: { json: async () => ({ is_available: false }) },
      })
    );
    expect(res.status).toBe(404);
  });
});
