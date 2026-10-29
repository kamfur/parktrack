import { describe, expect, it } from "vitest";
import { GET } from "./analytics";

function ctx(query: string, user: unknown = { id: "staff-1", email: "s@example.com", role: "staff" }) {
  return {
    url: new URL(`http://localhost/api/stats/analytics${query}`),
    locals: { user },
  } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/stats/analytics", () => {
  it("returns 401 without a user", async () => {
    expect((await GET(ctx("?from=2026-09-01&to=2026-09-30", null))).status).toBe(401);
  });

  it("rejects a reversed range", async () => {
    const res = await GET(ctx("?from=2026-09-30&to=2026-09-01"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Validation failed" });
  });

  it("rejects a daily range longer than 93 days", async () => {
    expect((await GET(ctx("?from=2026-01-01&to=2026-06-30&granularity=day"))).status).toBe(400);
  });

  it("rejects malformed dates", async () => {
    expect((await GET(ctx("?from=yesterday&to=today"))).status).toBe(400);
  });
});
