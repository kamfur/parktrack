import { describe, expect, it, vi } from "vitest";
import { GET } from "./calculate-cost";

const AGENCY_ID = "11111111-1111-4111-8111-111111111111";

function makeCtx(query: string, agency: { discount_pct: number; archived_at: string | null } | null = null) {
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: 50, error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: agency, error: null }),
    }),
  };
  return {
    ctx: {
      url: new URL(`http://localhost/api/calculate-cost?${query}`),
      locals: { supabase },
    } as unknown as Parameters<typeof GET>[0],
    supabase,
  };
}

const DATES = "check_in=2026-09-02T10:00:00Z&check_out=2026-09-07T10:00:00Z";

describe("GET /api/calculate-cost — travel agency", () => {
  it("returns the full price without an agency", async () => {
    const { ctx, supabase } = makeCtx(DATES);
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalCost: 50, baseCost: 50, discountPct: 0, days: 5 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns base price, discount and discounted total with an agency", async () => {
    const { ctx } = makeCtx(`${DATES}&travel_agency_id=${AGENCY_ID}`, { discount_pct: 15, archived_at: null });
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalCost: 42.5, baseCost: 50, discountPct: 15 });
  });

  it("rejects a malformed agency id with 400", async () => {
    const { ctx } = makeCtx(`${DATES}&travel_agency_id=biuro`);
    expect((await GET(ctx)).status).toBe(400);
  });

  it("returns 422 for an archived agency", async () => {
    const { ctx } = makeCtx(`${DATES}&travel_agency_id=${AGENCY_ID}`, { discount_pct: 15, archived_at: "2026-09-01" });
    expect((await GET(ctx)).status).toBe(422);
  });
});
