import { SonioxTokenError, type SonioxRegion, type SonioxTokenPort } from "./soniox-token.port";

export const SONIOX_TOKEN_TIMEOUT_MS = 5000;
export const SONIOX_TEMP_KEY_TTL_SECONDS = 60;

function readEnv(name: "SONIOX_API_KEY" | "SONIOX_REGION"): string | undefined {
  // process.env first (Railway runtime); an explicitly set empty value means "not configured".
  const value = process.env[name] ?? import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Server-side Soniox config. Region defaults to EU; "us"/"global" map to the global endpoint. */
export function readSonioxConfig(): { apiKey: string | undefined; region: SonioxRegion } {
  const region = readEnv("SONIOX_REGION")?.toLowerCase();
  return { apiKey: readEnv("SONIOX_API_KEY"), region: region === "us" || region === "global" ? "us" : "eu" };
}

export function sonioxApiHost(region: SonioxRegion): string {
  return region === "eu" ? "api.eu.soniox.com" : "api.soniox.com";
}

export function createSonioxTokenAdapter(options: {
  apiKey: string | undefined;
  region: SonioxRegion;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): SonioxTokenPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? SONIOX_TOKEN_TIMEOUT_MS;

  return {
    async createTemporaryKey(clientReferenceId) {
      if (!options.apiKey) throw new SonioxTokenError("not_configured", "SONIOX_API_KEY is not set");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`https://${sonioxApiHost(options.region)}/v1/auth/temporary-api-key`, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            usage_type: "transcribe_websocket",
            expires_in_seconds: SONIOX_TEMP_KEY_TTL_SECONDS,
            client_reference_id: clientReferenceId,
          }),
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) throw new SonioxTokenError("upstream", `Soniox HTTP ${response.status}`);
        const body = (await response.json()) as { api_key?: unknown; expires_at?: unknown };
        if (typeof body.api_key !== "string" || !body.api_key) {
          throw new SonioxTokenError("upstream", "Soniox response has no api_key");
        }
        return { apiKey: body.api_key, expiresAt: typeof body.expires_at === "string" ? body.expires_at : "" };
      } catch (error) {
        if (error instanceof SonioxTokenError) throw error;
        if (controller.signal.aborted)
          throw new SonioxTokenError("timeout", "Soniox request timed out", { cause: error });
        throw new SonioxTokenError("upstream", "Soniox request failed", { cause: error });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
