import type { APIRoute } from "astro";
import { ParkViaNotConfiguredError, ParkViaSyncBusyError, runParkViaSync } from "../../../../lib/parkvia/scheduler";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Staff-only (authMiddleware): pull ParkVia bookings now instead of waiting for the hourly run. No body. */
export const POST: APIRoute = async () => {
  try {
    const summary = await runParkViaSync();
    return json(summary, 200);
  } catch (error) {
    if (error instanceof ParkViaSyncBusyError) {
      return json({ error: { code: "sync_running", message: error.message } }, 409);
    }
    if (error instanceof ParkViaNotConfiguredError) {
      return json({ error: { code: "not_configured", message: error.message } }, 503);
    }
    // eslint-disable-next-line no-console
    console.error("ParkVia manual sync failed:", error);
    return json({ error: { code: "sync_failed", message: "ParkVia sync failed. Please try again later." } }, 502);
  }
};
