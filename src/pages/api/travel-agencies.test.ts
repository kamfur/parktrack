import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./travel-agencies";
import { DELETE, PATCH, PUT } from "./travel-agencies/[id]";

const AGENCY_ID = "11111111-1111-4111-8111-111111111111";
const validBody = {
  name: "Biuro Słońce",
  nip: "123-456-32-18",
  address: "ul. Morska 1, Gdańsk",
  discount_pct: 15,
  payment_term_days: 14,
};
const USER = { id: "u1" };

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    params: {},
    request: { json: async () => ({}) },
    url: new URL("http://localhost/api/travel-agencies"),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

/** Chainable PostgREST builder whose terminal call resolves to `result`. */
function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "is"]) b[method] = vi.fn(() => b);
  b.order = vi.fn().mockResolvedValue(result);
  b.single = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  // `.delete().eq().select("id")` awaits the builder itself.
  (b as unknown as { then: PromiseLike<unknown>["then"] }).then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return b;
}

function supabaseWith(result: { data: unknown; error: unknown }) {
  const b = builder(result);
  return { supabase: { from: vi.fn(() => b) }, b };
}

describe("GET /api/travel-agencies", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await GET(makeCtx())).status).toBe(401);
  });

  it("hides archived agencies unless include_archived=true", async () => {
    const { supabase, b } = supabaseWith({ data: [], error: null });
    await GET(makeCtx({ locals: { user: USER, supabase } }));
    expect(b.is).toHaveBeenCalledWith("archived_at", null);

    const second = supabaseWith({ data: [], error: null });
    await GET(
      makeCtx({
        locals: { user: USER, supabase: second.supabase },
        url: new URL("http://localhost/api/travel-agencies?include_archived=true"),
      })
    );
    expect(second.b.is).not.toHaveBeenCalled();
  });

  it("lists active agencies before archived ones", async () => {
    const rows = [
      { id: "a", name: "A", archived_at: "2026-09-01T00:00:00Z" },
      { id: "b", name: "B", archived_at: null },
    ];
    const { supabase } = supabaseWith({ data: rows, error: null });
    const res = await GET(
      makeCtx({
        locals: { user: USER, supabase },
        url: new URL("http://localhost/api/travel-agencies?include_archived=true"),
      })
    );
    expect((await res.json()).map((a: { id: string }) => a.id)).toEqual(["b", "a"]);
  });
});

describe("POST /api/travel-agencies", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await POST(makeCtx())).status).toBe(401);
  });

  it("returns 400 with a Polish message on an invalid NIP, before touching the database", async () => {
    const supabase = { from: vi.fn() };
    const res = await POST(
      makeCtx({
        locals: { user: USER, supabase },
        request: { json: async () => ({ ...validBody, nip: "1234563219" }) },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.fieldErrors.nip[0]).toMatch(/Nieprawidłowy NIP/);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("creates the agency with a normalized NIP (201)", async () => {
    const { supabase, b } = supabaseWith({ data: { id: AGENCY_ID }, error: null });
    const res = await POST(makeCtx({ locals: { user: USER, supabase }, request: { json: async () => validBody } }));
    expect(res.status).toBe(201);
    expect(b.insert).toHaveBeenCalledWith(expect.objectContaining({ nip: "1234563218", discount_pct: 15 }));
  });

  it("returns 409 on a duplicate NIP", async () => {
    const { supabase } = supabaseWith({ data: null, error: { code: "23505", message: "duplicate" } });
    const res = await POST(makeCtx({ locals: { user: USER, supabase }, request: { json: async () => validBody } }));
    expect(res.status).toBe(409);
  });
});

describe("PUT/PATCH/DELETE /api/travel-agencies/[id]", () => {
  it("rejects a non-UUID id", async () => {
    const res = await PUT(makeCtx({ locals: { user: USER }, params: { id: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a missing agency", async () => {
    const { supabase } = supabaseWith({ data: null, error: null });
    const res = await PUT(
      makeCtx({ locals: { user: USER, supabase }, params: { id: AGENCY_ID }, request: { json: async () => validBody } })
    );
    expect(res.status).toBe(404);
  });

  it("archives via PATCH { archived: true }", async () => {
    const { supabase, b } = supabaseWith({ data: { id: AGENCY_ID, archived_at: "x" }, error: null });
    const res = await PATCH(
      makeCtx({
        locals: { user: USER, supabase },
        params: { id: AGENCY_ID },
        request: { json: async () => ({ archived: true }) },
      })
    );
    expect(res.status).toBe(200);
    expect(b.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
  });

  it("returns 409 with the archive hint when the agency is referenced", async () => {
    const { supabase } = supabaseWith({ data: null, error: { code: "23503", message: "fk" } });
    const res = await DELETE(makeCtx({ locals: { user: USER, supabase }, params: { id: AGENCY_ID } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/zarchiwizować/);
  });

  it("returns 204 after deleting an unreferenced agency", async () => {
    const { supabase } = supabaseWith({ data: [{ id: AGENCY_ID }], error: null });
    const res = await DELETE(makeCtx({ locals: { user: USER, supabase }, params: { id: AGENCY_ID } }));
    expect(res.status).toBe(204);
  });
});
