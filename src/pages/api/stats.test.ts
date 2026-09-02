import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { GET } from "./stats";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";

describe("GET /api/stats — admin-client 503 guard", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null);
  });

  it("returns 503 when admin client is unavailable", async () => {
    const ctx = {
      url: new URL("http://localhost/api/stats?period=month"),
    } as unknown as Parameters<typeof GET>[0];
    const res = await GET(ctx);
    expect(res.status).toBe(503);
  });
});
