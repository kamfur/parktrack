import { fromWarsawDateTimeLocal, warsawDateKey } from "../calendar/warsaw-time";
import { KtwArrivalsError, type KtwArrivalsPort } from "./ktw-arrivals.port";
import type { KtwBoardRow } from "./select-arrival-hours";

/** JSON list the official public board (`tablica-lotow-online`) loads for arrivals. */
export const DEFAULT_KTW_ARRIVALS_URL = "https://www.katowice-airport.com/pl/api/flight-board/list";

export const OFFICIAL_KTW_BOARD_PAGE = "https://www.katowice-airport.com/pl/dla-pasazera/tablica-lotow-online";

export const KTW_ARRIVALS_TIMEOUT_MS = 3000;

const ARRIVAL_DIRECTION = 2;

interface BoardFlightRow {
  airport?: unknown;
  origin?: unknown;
  originLabel?: unknown;
  scheduled_time?: unknown;
  scheduledAt?: unknown;
  scheduled_at?: unknown;
  direction?: unknown;
}

function readEnvUrl(): string | undefined {
  const fromProcess = process.env.KTW_ARRIVALS_URL?.trim();
  if (fromProcess) return fromProcess;
  const fromMeta = import.meta.env.KTW_ARRIVALS_URL;
  return typeof fromMeta === "string" && fromMeta.trim() ? fromMeta.trim() : undefined;
}

function isOfficialBoardPage(url: string): boolean {
  return url.includes("tablica-lotow-online") || url.includes("flight-board-online");
}

export function resolveKtwArrivalsUrl(): string {
  const raw = readEnvUrl() ?? DEFAULT_KTW_ARRIVALS_URL;
  return isOfficialBoardPage(raw) ? DEFAULT_KTW_ARRIVALS_URL : raw;
}

export function arrivalsRequestUrl(base: string, now: Date): string {
  const url = new URL(base);
  if (!url.searchParams.has("direction")) {
    url.searchParams.set("direction", String(ARRIVAL_DIRECTION));
  }
  if (!url.searchParams.has("date")) {
    url.searchParams.set("date", warsawDateKey(now));
  }
  return url.toString();
}

function readOrigin(row: BoardFlightRow): string | null {
  for (const value of [row.airport, row.origin, row.originLabel]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function scheduledToIso(value: unknown, now: Date): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  const clock = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!clock) return null;
  const hour = clock[1].padStart(2, "0");
  return fromWarsawDateTimeLocal(`${warsawDateKey(now)}T${hour}:${clock[2]}`);
}

function mapBoardRow(row: BoardFlightRow, now: Date): KtwBoardRow | null {
  if (row.direction != null && Number(row.direction) !== ARRIVAL_DIRECTION) {
    return null;
  }
  const originLabel = readOrigin(row);
  const scheduledAt = scheduledToIso(row.scheduled_time ?? row.scheduledAt ?? row.scheduled_at, now);
  if (!originLabel || !scheduledAt) return null;
  return { originLabel, scheduledAt };
}

function extractRawRows(payload: unknown): BoardFlightRow[] | null {
  if (Array.isArray(payload)) return payload as BoardFlightRow[];
  if (payload && typeof payload === "object") {
    const record = payload as { data?: unknown; arrivals?: unknown };
    if (Array.isArray(record.data)) return record.data as BoardFlightRow[];
    if (Array.isArray(record.arrivals)) return record.arrivals as BoardFlightRow[];
  }
  return null;
}

export function parseKatowiceBoardPayload(body: string, now: Date): KtwBoardRow[] {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new KtwArrivalsError("KTW board payload is empty");
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const rawRows = extractRawRows(parsed);
    if (rawRows) {
      return rawRows.map((row) => mapBoardRow(row, now)).filter((row): row is KtwBoardRow => row != null);
    }
  } catch (error) {
    if (error instanceof KtwArrivalsError) throw error;
  }

  throw new KtwArrivalsError("KTW board payload could not be parsed");
}

export function createKatowiceBoardAdapter(options?: {
  fetchImpl?: typeof fetch;
  url?: string;
  timeoutMs?: number;
}): KtwArrivalsPort {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? KTW_ARRIVALS_TIMEOUT_MS;
  const url = options?.url ?? resolveKtwArrivalsUrl();

  return {
    async listArrivals(now: Date): Promise<KtwBoardRow[]> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(arrivalsRequestUrl(url, now), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new KtwArrivalsError(`KTW board HTTP ${response.status}`);
        }
        return parseKatowiceBoardPayload(await response.text(), now);
      } catch (error) {
        if (error instanceof KtwArrivalsError) throw error;
        throw new KtwArrivalsError("KTW board fetch failed", { cause: error });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
