import { describe, expect, it, vi } from "vitest";
import { GET as GET_SUMMARY } from "./travel-agencies/[id]/summary";
import { POST as ISSUE } from "./travel-agencies/[id]/invoices";

const AGENCY_ID = "11111111-1111-4111-8111-111111111111";
const USER = { id: "u1" };

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    locals: {},
    params: { id: AGENCY_ID },
    request: { json: async () => ({}) },
    url: new URL(`http://localhost/api/travel-agencies/${AGENCY_ID}/summary`),
    ...overrides,
  } as unknown as Parameters<typeof GET_SUMMARY>[0];
}

function supabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    rpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
}

describe("GET /api/travel-agencies/[id]/summary", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await GET_SUMMARY(makeCtx())).status).toBe(401);
  });

  it("returns 400 for a malformed month", async () => {
    const res = await GET_SUMMARY(
      makeCtx({
        locals: { user: USER },
        url: new URL(`http://localhost/api/travel-agencies/${AGENCY_ID}/summary?month=2026-8`),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns the month summary", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const res = await GET_SUMMARY(
      makeCtx({
        locals: { user: USER, supabase: supabase(rpc) },
        url: new URL(`http://localhost/api/travel-agencies/${AGENCY_ID}/summary?month=2026-08`),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).month).toBe("2026-08");
  });
});

describe("POST /api/travel-agencies/[id]/invoices", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await ISSUE(makeCtx())).status).toBe(401);
  });

  it("returns 400 without a valid month", async () => {
    const res = await ISSUE(
      makeCtx({ locals: { user: USER }, request: { json: async () => ({ month: "sierpień" }) } })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 with the blocking reservations", async () => {
    const rpc = vi.fn((name: string) =>
      Promise.resolve(
        name === "create_agency_invoice"
          ? { data: null, error: { message: "BLOCKING_RESERVATIONS: 1" } }
          : {
              data: [
                {
                  reservation_id: "r1",
                  category: "blocking",
                  total_cost: 10,
                  net_amount: null,
                  vat_amount: null,
                  gross_amount: null,
                },
                {
                  reservation_id: "r2",
                  category: "invoiceable",
                  total_cost: 10,
                  net_amount: 8.13,
                  vat_amount: 1.87,
                  gross_amount: 10,
                },
              ],
              error: null,
            }
      )
    );
    const res = await ISSUE(
      makeCtx({
        locals: { user: USER, supabase: supabase(rpc) },
        request: { json: async () => ({ month: "2026-08" }) },
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("BLOCKING_RESERVATIONS");
    expect(body.blocking.map((r: { reservation_id: string }) => r.reservation_id)).toEqual(["r1"]);
  });

  it("returns 422 while the month is open", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "MONTH_NOT_CLOSED: 2026-9" } });
    const res = await ISSUE(
      makeCtx({
        locals: { user: USER, supabase: supabase(rpc) },
        request: { json: async () => ({ month: "2026-09" }) },
      })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/Miesiąc jeszcze trwa/);
  });

  it("returns 201 with the invoice id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "inv-1", error: null });
    const res = await ISSUE(
      makeCtx({
        locals: { user: USER, supabase: supabase(rpc) },
        request: { json: async () => ({ month: "2026-08" }) },
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ invoiceId: "inv-1" });
  });
});
