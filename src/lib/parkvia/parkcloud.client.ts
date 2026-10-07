import { z } from "zod";
import {
  ParkCloudError,
  parkCloudArrivalSchema,
  parkCloudBookingSchema,
  parkCloudEventSchema,
  parkCloudOperatorSchema,
  type ParkCloudPort,
} from "./parkcloud.port";

export const PARKCLOUD_BASE_URL = "https://parkcloud.azure-api.net/rest/operator/v1.svc";

export const PARKCLOUD_TIMEOUT_MS = 15_000;

/** Measured on the Operator API subscription: the 11th call within a minute gets 429. */
export const PARKCLOUD_RATE_LIMIT = { requests: 10, windowMs: 60_000 };

/** How many times a 429 is waited out (Retry-After) before the call fails. */
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 120_000;

export interface ParkCloudCredentials {
  /** Private key from parkcloud.net → Operator API (sent as `?key=`). */
  apiKey: string;
  /** Azure API Management subscription key from the developer portal. */
  subscriptionKey: string;
}

export interface ParkCloudClientOptions {
  fetchFn?: typeof fetch;
  baseUrl?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * HTTP adapter for the ParkCloud Operator API; every response is validated before it is used.
 * Calls are paced to the subscription rate limit, and a 429 is waited out, so a long first import
 * is slow rather than failing.
 */
export class ParkCloudClient implements ParkCloudPort {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  /** Start times of calls in the current rate-limit window. */
  private sent: number[] = [];

  constructor(
    private readonly credentials: ParkCloudCredentials,
    options: ParkCloudClientOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = options.baseUrl ?? PARKCLOUD_BASE_URL;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  async getOperators() {
    return this.get("/operators", z.array(parkCloudOperatorSchema));
  }

  async getEventsByAge(operatorId: string, hours: number) {
    const whole = Math.max(1, Math.ceil(hours));
    return this.get(`/operator/${enc(operatorId)}/bookings/events/age/${whole}`, z.array(parkCloudEventSchema));
  }

  async getEventsSince(operatorId: string, eventId: number) {
    return this.get(`/operator/${enc(operatorId)}/bookings/events/since/${eventId}`, z.array(parkCloudEventSchema));
  }

  async getArrivalReferences(operatorId: string, dateKey: string) {
    const rows = await this.get(
      `/operator/${enc(operatorId)}/bookings/arrivals/${enc(dateKey)}`,
      z.array(parkCloudArrivalSchema)
    );
    return rows.map((row) => row.BookingReference);
  }

  async getBooking(operatorId: string, reference: string) {
    return this.get(`/operator/${enc(operatorId)}/booking/${enc(reference)}`, parkCloudBookingSchema);
  }

  private async get<T extends z.ZodTypeAny>(path: string, schema: T): Promise<z.output<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("key", this.credentials.apiKey);

    let response: Response;
    let body: string;
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      try {
        response = await this.fetchFn(url, {
          headers: { Accept: "application/json", "Ocp-Apim-Subscription-Key": this.credentials.subscriptionKey },
          signal: AbortSignal.timeout(PARKCLOUD_TIMEOUT_MS),
        });
      } catch (error) {
        // Never echo the URL: it carries the private key.
        throw new ParkCloudError(`ParkCloud request failed for ${path}: ${(error as Error).message}`);
      }
      body = await response.text();
      if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) break;
      await this.sleep(retryAfterMs(response, body));
    }

    if (!response.ok) {
      throw new ParkCloudError(`ParkCloud ${path} answered ${response.status}: ${readMessage(body)}`, response.status);
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ParkCloudError(`ParkCloud ${path} returned non-JSON`);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ParkCloudError(`ParkCloud ${path} returned an unexpected shape: ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data;
  }

  /** Sliding window: wait until a call slot is free, then take it (no await between check and take). */
  private async throttle(): Promise<void> {
    const { requests, windowMs } = PARKCLOUD_RATE_LIMIT;
    for (;;) {
      const now = this.now();
      this.sent = this.sent.filter((startedAt) => startedAt > now - windowMs);
      if (this.sent.length < requests) {
        this.sent.push(now);
        return;
      }
      await this.sleep(this.sent[0] + windowMs - now + 250);
    }
  }
}

/** Retry-After header, else the "Try again in N seconds" text, else a full window; plus a margin. */
function retryAfterMs(response: Response, body: string): number {
  const header = Number(response.headers.get("retry-after"));
  const fromText = Number(body.match(/try again in (\d+) seconds?/i)?.[1]);
  const seconds = Number.isFinite(header) && header > 0 ? header : Number.isFinite(fromText) ? fromText : 60;
  return Math.min(seconds * 1000 + 1000, MAX_RETRY_WAIT_MS);
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function readMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { Message?: unknown; message?: unknown };
    const message = parsed.Message ?? parsed.message;
    if (typeof message === "string") return message.slice(0, 200);
  } catch {
    // fall through to the raw body
  }
  return body.slice(0, 200);
}

/** Credentials from the environment, or null when the integration is not configured. */
export function readParkCloudCredentials(): ParkCloudCredentials | null {
  const apiKey = (process.env.PARKCLOUD_API_KEY ?? import.meta.env.PARKCLOUD_API_KEY)?.trim();
  const subscriptionKey = (
    process.env.PARKCLOUD_SUBSCRIPTION_KEY ?? import.meta.env.PARKCLOUD_SUBSCRIPTION_KEY
  )?.trim();
  return apiKey && subscriptionKey ? { apiKey, subscriptionKey } : null;
}
