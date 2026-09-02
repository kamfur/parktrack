import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { PATCH } from "./settings";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";

function makePatchCtx(key: string, body: unknown) {
  return {
    url: new URL(`http://localhost/api/settings?key=eq.${key}`),
    request: { json: async () => body },
  } as unknown as Parameters<typeof PATCH>[0];
}

describe("PATCH /api/settings — admin-client 503 guard", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null);
  });

  it("returns 503 when admin client is unavailable", async () => {
    const res = await PATCH(makePatchCtx("daily_rate", { value: "100" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
