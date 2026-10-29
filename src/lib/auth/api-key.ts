import { createHash, timingSafeEqual } from "node:crypto";

export type ApiKeyCheck = "ok" | "missing_secret" | "invalid";

/**
 * Verifies a machine API key (e.g. `X-API-Key`) against the configured secret.
 * Compares SHA-256 digests with a constant-time comparison so neither the
 * content nor the length of the secret leaks through timing.
 */
export function verifyApiKey(header: string | null | undefined, secret: string | undefined): ApiKeyCheck {
  if (!secret) return "missing_secret";
  if (!header) return "invalid";

  const provided = createHash("sha256").update(header).digest();
  const expected = createHash("sha256").update(secret).digest();

  return timingSafeEqual(provided, expected) ? "ok" : "invalid";
}
