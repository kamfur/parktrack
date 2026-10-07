import type { APIRoute } from "astro";
import { z } from "zod";
import { createSonioxTokenAdapter, readSonioxConfig } from "../../../lib/voice/soniox-token.adapter";
import { SonioxTokenError } from "../../../lib/voice/soniox-token.port";

export const prerender = false;

/** The route takes no input; reject anything else at the boundary. */
const bodySchema = z.object({}).strict();

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * POST /api/voice/token — short-lived Soniox key for the browser's real-time WebSocket
 * (voice reservations). Staff and drivers; the main SONIOX_API_KEY never leaves the server.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);

  const raw = await request.text();
  if (raw.trim()) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return json({ error: "Validation failed" }, 400);
    }
    if (!bodySchema.safeParse(parsedJson).success) return json({ error: "Validation failed" }, 400);
  }

  const config = readSonioxConfig();
  try {
    const key = await createSonioxTokenAdapter(config).createTemporaryKey(`parktrack-${locals.user.id}`);
    return json({ api_key: key.apiKey, expires_at: key.expiresAt, region: config.region }, 200);
  } catch (error) {
    if (error instanceof SonioxTokenError && error.code === "not_configured") {
      return json({ error: "voice_not_configured" }, 503);
    }
    // eslint-disable-next-line no-console
    console.error("Soniox temporary key failed:", error);
    return json({ error: "voice_upstream_error" }, 502);
  }
};
