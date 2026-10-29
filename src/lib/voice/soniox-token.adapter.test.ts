import { afterEach, describe, expect, it, vi } from "vitest";
import { createSonioxTokenAdapter, readSonioxConfig } from "./soniox-token.adapter";
import { SonioxTokenError } from "./soniox-token.port";

function okFetch(body: unknown = { api_key: "temp:abc", expires_at: "2026-10-01T10:01:00Z" }) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 200 }));
}

describe("createSonioxTokenAdapter", () => {
  it("posts to the EU host with a 60 s transcribe_websocket key", async () => {
    const fetchImpl = okFetch();
    const key = await createSonioxTokenAdapter({ apiKey: "main", region: "eu", fetchImpl }).createTemporaryKey("ref-1");

    expect(key).toEqual({ apiKey: "temp:abc", expiresAt: "2026-10-01T10:01:00Z" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.eu.soniox.com/v1/auth/temporary-api-key");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer main" });
    expect(JSON.parse(String(init?.body))).toEqual({
      usage_type: "transcribe_websocket",
      expires_in_seconds: 60,
      client_reference_id: "ref-1",
    });
  });

  it("uses the global host for the us region", async () => {
    const fetchImpl = okFetch();
    await createSonioxTokenAdapter({ apiKey: "main", region: "us", fetchImpl }).createTemporaryKey("ref");
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.soniox.com/v1/auth/temporary-api-key");
  });

  it("fails as not_configured without a key, without calling Soniox", async () => {
    const fetchImpl = okFetch();
    await expect(
      createSonioxTokenAdapter({ apiKey: undefined, region: "eu", fetchImpl }).createTemporaryKey("ref")
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps non-OK and malformed responses to upstream", async () => {
    const http500 = vi.fn<typeof fetch>(async () => new Response("no", { status: 500 }));
    await expect(
      createSonioxTokenAdapter({ apiKey: "k", region: "eu", fetchImpl: http500 }).createTemporaryKey("r")
    ).rejects.toMatchObject({ code: "upstream" });
    await expect(
      createSonioxTokenAdapter({ apiKey: "k", region: "eu", fetchImpl: okFetch({}) }).createTemporaryKey("r")
    ).rejects.toMatchObject({ code: "upstream" });
  });

  it("maps an aborted request to timeout", async () => {
    const hang = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );
    const error = await createSonioxTokenAdapter({ apiKey: "k", region: "eu", fetchImpl: hang, timeoutMs: 10 })
      .createTemporaryKey("r")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SonioxTokenError);
    expect((error as SonioxTokenError).code).toBe("timeout");
  });
});

describe("readSonioxConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to EU and maps global/us to us", () => {
    vi.stubEnv("SONIOX_API_KEY", "k");
    vi.stubEnv("SONIOX_REGION", "");
    expect(readSonioxConfig()).toEqual({ apiKey: "k", region: "eu" });
    vi.stubEnv("SONIOX_REGION", "global");
    expect(readSonioxConfig().region).toBe("us");
  });

  it("treats an empty key as not configured", () => {
    vi.stubEnv("SONIOX_API_KEY", "");
    expect(readSonioxConfig().apiKey).toBeUndefined();
  });
});
