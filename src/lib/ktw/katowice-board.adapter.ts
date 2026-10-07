import { addUtcDays, fromWarsawDateTimeLocal, warsawDateKey } from "../calendar/warsaw-time";
import { KtwArrivalsError, type KtwArrivalsPort } from "./ktw-arrivals.port";
import type { KtwBoardRow } from "./select-arrival-hours";

/** JSON list the official public board (`tablica-lotow-online`) loads for arrivals. */
export const DEFAULT_KTW_ARRIVALS_URL = "https://www.katowice-airport.com/pl/api/flight-board/list";

export const OFFICIAL_KTW_BOARD_PAGE = "https://www.katowice-airport.com/pl/dla-pasazera/tablica-lotow-online";

export const KTW_ARRIVALS_TIMEOUT_MS = 3000;

/** Official days are small; cap so a huge payload cannot fan out across 200 reservations. */
export const MAX_PARSED_BOARD_ROWS = 500;

const ARRIVAL_DIRECTION = 2;

interface BoardFlightRow {
  airport?: unknown;
  origin?: unknown;
  originLabel?: unknown;
  scheduled_time?: unknown;
  scheduledAt?: unknown;
  scheduled_at?: unknown;
  direction?: unknown;
  status?: unknown;
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

function isAllowedKtwHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "katowice-airport.com" || host.endsWith(".katowice-airport.com");
}

/** Reject non-https / non-KTW hosts so a poisoned env cannot SSRF. */
export function assertAllowedKtwArrivalsUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new KtwArrivalsError("KTW board URL is invalid");
  }
  if (parsed.protocol !== "https:") {
    throw new KtwArrivalsError("KTW board URL must be https");
  }
  if (!isAllowedKtwHost(parsed.hostname)) {
    throw new KtwArrivalsError("KTW board URL host is not allowed");
  }
  return isOfficialBoardPage(raw) ? DEFAULT_KTW_ARRIVALS_URL : parsed.toString();
}

export function resolveKtwArrivalsUrl(): string {
  return assertAllowedKtwArrivalsUrl(readEnvUrl() ?? DEFAULT_KTW_ARRIVALS_URL);
}

/** Official board only exposes yesterday / today / tomorrow — needed so 23:00 + 00:10 still match. */
export function boardDateKeys(now: Date): string[] {
  const today = warsawDateKey(now);
  return [addUtcDays(today, -1), today, addUtcDays(today, 1)];
}

export function arrivalsRequestUrl(base: string, dateKey: string): string {
  const url = new URL(base);
  if (!url.searchParams.has("direction")) {
    url.searchParams.set("direction", String(ARRIVAL_DIRECTION));
  }
  url.searchParams.set("date", dateKey);
  return url.toString();
}

function dateKeysToFetch(base: string, now: Date): string[] {
  const pinned = new URL(base).searchParams.get("date");
  return pinned ? [pinned] : boardDateKeys(now);
}

function readOrigin(row: BoardFlightRow): string | null {
  for (const value of [row.airport, row.origin, row.originLabel]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function scheduledToIso(value: unknown, dateKey: string): string | null {
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
  return fromWarsawDateTimeLocal(`${dateKey}T${hour}:${clock[2]}`);
}

function mapBoardRow(row: BoardFlightRow, dateKey: string): KtwBoardRow | null {
  if (row.direction != null && Number(row.direction) !== ARRIVAL_DIRECTION) {
    return null;
  }
  const originLabel = readOrigin(row);
  const scheduledAt = scheduledToIso(row.scheduled_time ?? row.scheduledAt ?? row.scheduled_at, dateKey);
  if (!originLabel || !scheduledAt) return null;
  const status = typeof row.status === "string" && row.status.trim() ? row.status.trim() : undefined;
  return status ? { originLabel, scheduledAt, status } : { originLabel, scheduledAt };
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

export function parseKatowiceBoardPayload(body: string, dateContext: Date | string): KtwBoardRow[] {
  const dateKey = typeof dateContext === "string" ? dateContext : warsawDateKey(dateContext);
  const trimmed = body.trim();
  if (!trimmed) {
    throw new KtwArrivalsError("KTW board payload is empty");
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const rawRows = extractRawRows(parsed);
    if (rawRows) {
      return rawRows
        .map((row) => mapBoardRow(row, dateKey))
        .filter((row): row is KtwBoardRow => row != null)
        .slice(0, MAX_PARSED_BOARD_ROWS);
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
      const dateKeys = dateKeysToFetch(url, now);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const settled = await Promise.all(
          dateKeys.map(async (dateKey) => {
            try {
              const response = await fetchImpl(arrivalsRequestUrl(url, dateKey), {
                method: "GET",
                headers: { Accept: "application/json" },
                redirect: "error",
                signal: controller.signal,
              });
              if (!response.ok) {
                throw new KtwArrivalsError(`KTW board HTTP ${response.status}`);
              }
              return parseKatowiceBoardPayload(await response.text(), dateKey);
            } catch (error) {
              return error instanceof KtwArrivalsError
                ? error
                : new KtwArrivalsError("KTW board fetch failed", { cause: error });
            }
          })
        );
        const rows = settled.filter((item): item is KtwBoardRow[] => Array.isArray(item)).flat();
        if (settled.every((item) => item instanceof KtwArrivalsError)) {
          throw settled[0] ?? new KtwArrivalsError("KTW board fetch failed");
        }
        return rows;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
