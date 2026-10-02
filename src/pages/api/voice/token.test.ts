import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./token";

function makeCtx(user: { id: string } | null = { id: "user-1" }, body?: string) {
  return {
    request: new Request("http://localhost/api/voice/token", { method: "POST", body }),
    locals: { user, supabase: {} },
  } as unknown as Parameters<typeof POST>[0];
}

const fetchMock = vi.fn<typeof fetch>();

describe("POST /api/voice/token", () => {
  beforeEach(() => {
    vi.stubEnv("SONIOX_API_KEY", "main-key");
    vi.stubEnv("SONIOX_REGION", "eu");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 401 without a user and does not call Soniox", async () => {
    expect((await POST(makeCtx(null))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a temporary key and the region", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ api_key: "temp:1", expires_at: "2026-10-01T10:01:00Z" }), { status: 200 })
    );
    const res = await POST(makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ api_key: "temp:1", expires_at: "2026-10-01T10:01:00Z", region: "eu" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.client_reference_id).toBe("parktrack-user-1");
  });

  it("returns 503 when Soniox is not configured", async () => {
    vi.stubEnv("SONIOX_API_KEY", "");
    const res = await POST(makeCtx());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "voice_not_configured" });
  });

  it("returns 502 when Soniox fails", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    expect((await POST(makeCtx())).status).toBe(502);
  });

  it("rejects a non-empty body", async () => {
    expect((await POST(makeCtx({ id: "u" }, JSON.stringify({ model: "x" })))).status).toBe(400);
    expect((await POST(makeCtx({ id: "u" }, "not json"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an empty JSON object body", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ api_key: "t" }), { status: 200 }));
    expect((await POST(makeCtx({ id: "u" }, "{}"))).status).toBe(200);
  });
});
