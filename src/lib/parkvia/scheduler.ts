import { createSupabaseAdminClient } from "../supabase-admin";
import { ParkViaSyncService, type ParkViaSyncSummary } from "../services/parkvia-sync.service";
import { ParkCloudClient, readParkCloudCredentials } from "./parkcloud.client";

export const DEFAULT_SYNC_INTERVAL_MINUTES = 60;
/** Let the server settle (and Railway's health check pass) before the first pull. */
const FIRST_RUN_DELAY_MS = 60_000;

export class ParkViaSyncBusyError extends Error {
  constructor() {
    super("ParkVia sync is already running");
    this.name = "ParkViaSyncBusyError";
  }
}

export class ParkViaNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`ParkVia sync is not configured: ${missing}`);
    this.name = "ParkViaNotConfiguredError";
  }
}

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null;
  running: Promise<ParkViaSyncSummary> | null;
}

// On globalThis so HMR / repeated middleware imports never start a second timer.
const STATE_KEY = Symbol.for("parktrack.parkviaSync");
const globalState = globalThis as unknown as Record<symbol, SchedulerState | undefined>;
const state: SchedulerState = (globalState[STATE_KEY] ??= { timer: null, running: null });

function readEnv(name: "PARKVIA_SYNC_ENABLED" | "PARKVIA_SYNC_INTERVAL_MINUTES"): string | undefined {
  return (process.env[name] ?? import.meta.env[name])?.trim() || undefined;
}

/** One sync run; concurrent callers (timer + manual button) are rejected instead of queued. */
export async function runParkViaSync(): Promise<ParkViaSyncSummary> {
  if (state.running) throw new ParkViaSyncBusyError();

  const credentials = readParkCloudCredentials();
  if (!credentials) throw new ParkViaNotConfiguredError("PARKCLOUD_API_KEY / PARKCLOUD_SUBSCRIPTION_KEY");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new ParkViaNotConfiguredError("SUPABASE_SERVICE_ROLE_KEY");

  state.running = new ParkViaSyncService(admin, new ParkCloudClient(credentials)).run();
  try {
    return await state.running;
  } finally {
    state.running = null;
  }
}

/** Starts the hourly pull when PARKVIA_SYNC_ENABLED=true; a no-op otherwise or when already started. */
export function startParkViaScheduler(): void {
  if (state.timer || readEnv("PARKVIA_SYNC_ENABLED") !== "true") return;

  const minutes = Number(readEnv("PARKVIA_SYNC_INTERVAL_MINUTES") ?? DEFAULT_SYNC_INTERVAL_MINUTES);
  const intervalMs = (Number.isFinite(minutes) && minutes >= 5 ? minutes : DEFAULT_SYNC_INTERVAL_MINUTES) * 60_000;

  const tick = () => {
    runParkViaSync()
      .then((summary) => {
        // eslint-disable-next-line no-console
        console.info("ParkVia sync finished:", JSON.stringify({ ...summary, errors: summary.errors.slice(0, 5) }));
      })
      .catch((error: unknown) => {
        if (error instanceof ParkViaSyncBusyError) return;
        // eslint-disable-next-line no-console
        console.error("ParkVia sync failed:", error);
      });
  };

  state.timer = setInterval(tick, intervalMs);
  state.timer.unref?.();
  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
}
