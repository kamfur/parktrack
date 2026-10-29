import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./price-lists";
import { PUT, DELETE } from "./price-lists/[id]";

const rate = { day_prices: Array.from({ length: 14 }, (_, i) => 40 + i * 10), extra_day_price: 10 };
const validBody = {
  valid_from: "2027-02-01",
  valid_to: "2027-05-15",
  rates: { open_air: rate, carport: rate, garage: rate },
};
const LIST_ID = "11111111-1111-4111-8111-111111111111";

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    params: {},
    request: { json: async () => ({}) },
    url: new URL("http://localhost/api/price-lists"),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/price-lists", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await GET(makeCtx())).status).toBe(401);
  });

  it("maps rows to one numeric rate entry per parking type", async () => {
    const row = {
      id: LIST_ID,
      valid_from: "2000-01-01",
      valid_to: null,
      created_at: "x",
      updated_at: "x",
      price_list_rates: [
        { parking_type: "open_air", day_prices: ["30.00", ...rate.day_prices.slice(1)], extra_day_price: "20.00" },
      ],
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [row], error: null }),
      }),
    };
    const res = await GET(makeCtx({ locals: { user: { id: "u1" }, supabase } }));
    expect(res.status).toBe(200);
    const [list] = await res.json();
    expect(list.rates.open_air.day_prices[0]).toBe(30);
    expect(list.rates.open_air.extra_day_price).toBe(20);
    // Missing rows are filled with zeros so the UI always has three rows.
    expect(list.rates.garage.day_prices).toHaveLength(14);
  });
});

describe("POST /api/price-lists", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await POST(makeCtx())).status).toBe(401);
  });

  it("returns 400 on invalid input before touching the database", async () => {
    const supabase = { rpc: vi.fn() };
    const res = await POST(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        request: { json: async () => ({ ...validBody, valid_to: "2027-01-01" }) },
      })
    );
    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("saves the list and its three rate rows atomically via save_price_list", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: LIST_ID, error: null }) };
    const res = await POST(
      makeCtx({ locals: { user: { id: "u1" }, supabase }, request: { json: async () => validBody } })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: LIST_ID });
    expect(supabase.rpc).toHaveBeenCalledWith("save_price_list", {
      p_id: null,
      p_valid_from: "2027-02-01",
      p_valid_to: "2027-05-15",
      p_rates: [
        { parking_type: "open_air", ...rate },
        { parking_type: "carport", ...rate },
        { parking_type: "garage", ...rate },
      ],
    });
  });

  it("returns 409 when a list with the same start date exists", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } }),
    };
    const res = await POST(
      makeCtx({ locals: { user: { id: "u1" }, supabase }, request: { json: async () => validBody } })
    );
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/price-lists/[id]", () => {
  it("rejects an invalid id", async () => {
    const res = await PUT(makeCtx({ locals: { user: { id: "u1" }, supabase: {} }, params: { id: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the list does not exist", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "PRICE_LIST_NOT_FOUND" } }),
    };
    const res = await PUT(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        params: { id: LIST_ID },
        request: { json: async () => validBody },
      })
    );
    expect(res.status).toBe(404);
  });

  it("replaces an existing list", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: LIST_ID, error: null }) };
    const res = await PUT(
      makeCtx({
        locals: { user: { id: "u1" }, supabase },
        params: { id: LIST_ID },
        request: { json: async () => ({ ...validBody, valid_to: null }) },
      })
    );
    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "save_price_list",
      expect.objectContaining({ p_id: LIST_ID, p_valid_to: null })
    );
  });
});

describe("DELETE /api/price-lists/[id]", () => {
  function supabaseWithDeleted(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    };
  }

  it("rejects unauthenticated requests", async () => {
    expect((await DELETE(makeCtx({ params: { id: LIST_ID } }))).status).toBe(401);
  });

  it("deletes an existing list", async () => {
    const res = await DELETE(
      makeCtx({
        locals: { user: { id: "u1" }, supabase: supabaseWithDeleted([{ id: LIST_ID }]) },
        params: { id: LIST_ID },
      })
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when nothing was deleted", async () => {
    const res = await DELETE(
      makeCtx({ locals: { user: { id: "u1" }, supabase: supabaseWithDeleted([]) }, params: { id: LIST_ID } })
    );
    expect(res.status).toBe(404);
  });
});
