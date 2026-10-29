import { describe, expect, it, vi } from "vitest";
import { PARKCLOUD_RATE_LIMIT, ParkCloudClient } from "./parkcloud.client";
import { ParkCloudError } from "./parkcloud.port";

const credentials = { apiKey: "private-key", subscriptionKey: "sub-key" };

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
}

describe("ParkCloudClient", () => {
  it("sends the private key as ?key= and the subscription key as the APIM header", async () => {
    const fetchFn = respond(200, [{ Id: 1500, Name: "Parking" }]);
    const client = new ParkCloudClient(credentials, { fetchFn, baseUrl: "https://api.test/v1.svc" });

    await expect(client.getOperators()).resolves.toEqual([{ Id: "1500", Name: "Parking" }]);

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://api.test/v1.svc/operators?key=private-key");
    expect(init.headers).toMatchObject({ "Ocp-Apim-Subscription-Key": "sub-key" });
  });

  it("builds event, arrival and booking paths", async () => {
    const fetchFn = vi.fn(async (url: URL) => {
      const path = url.pathname;
      if (path.endsWith("/arrivals/2026-10-11")) return new Response(JSON.stringify([{ BookingReference: "R1" }]));
      return new Response("[]");
    });
    const client = new ParkCloudClient(credentials, { fetchFn: fetchFn as never, baseUrl: "https://api.test/v1.svc" });

    await client.getEventsByAge("1500", 4.2);
    await client.getEventsSince("1500", 35949684);
    await expect(client.getArrivalReferences("1500", "2026-10-11")).resolves.toEqual(["R1"]);

    expect(fetchFn.mock.calls.map(([url]) => url.pathname)).toEqual([
      "/v1.svc/operator/1500/bookings/events/age/5",
      "/v1.svc/operator/1500/bookings/events/since/35949684",
      "/v1.svc/operator/1500/bookings/arrivals/2026-10-11",
    ]);
  });

  it("maps an error answer to ParkCloudError with the status and message, without leaking the key", async () => {
    const client = new ParkCloudClient(credentials, { fetchFn: respond(403, { Message: "Access denied" }) });

    const error = await client.getBooking("1500", "NOPE").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ParkCloudError);
    expect(error).toMatchObject({ status: 403 });
    expect((error as Error).message).toContain("Access denied");
    expect((error as Error).message).not.toContain("private-key");
  });

  it("rejects a response that does not match the expected shape", async () => {
    const client = new ParkCloudClient(credentials, { fetchFn: respond(200, [{ Id: "x" }]) });
    await expect(client.getEventsSince("1500", 1)).rejects.toThrow(/unexpected shape/);
  });

  it("wraps network failures", async () => {
    const client = new ParkCloudClient(credentials, { fetchFn: vi.fn().mockRejectedValue(new Error("ECONNRESET")) });
    await expect(client.getOperators()).rejects.toThrow(ParkCloudError);
  });

  describe("rate limit", () => {
    /** Fake clock: sleep() advances it instead of waiting. */
    function fakeClock() {
      let now = 0;
      const sleeps: number[] = [];
      return {
        now: () => now,
        sleep: vi.fn(async (ms: number) => {
          sleeps.push(ms);
          now += ms;
        }),
        sleeps,
      };
    }

    it(`paces calls to ${PARKCLOUD_RATE_LIMIT.requests} per window`, async () => {
      const clock = fakeClock();
      const fetchFn = vi.fn(async () => new Response("[]"));
      const client = new ParkCloudClient(credentials, { fetchFn, ...clock });

      for (let i = 0; i < PARKCLOUD_RATE_LIMIT.requests + 1; i++) await client.getEventsSince("1500", i);

      expect(fetchFn).toHaveBeenCalledTimes(PARKCLOUD_RATE_LIMIT.requests + 1);
      expect(clock.sleeps).toEqual([PARKCLOUD_RATE_LIMIT.windowMs + 250]);
    });

    it("waits out a 429 (Retry-After) and retries", async () => {
      const clock = fakeClock();
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }))
        .mockResolvedValueOnce(new Response("[]"));
      const client = new ParkCloudClient(credentials, { fetchFn, ...clock });

      await expect(client.getEventsSince("1500", 1)).resolves.toEqual([]);
      expect(clock.sleeps).toEqual([8000]);
    });

    it("reads the wait from the APIM message when there is no header, and gives up after 2 retries", async () => {
      const clock = fakeClock();
      const limited = () =>
        new Response(JSON.stringify({ statusCode: 429, message: "Rate limit is exceeded. Try again in 59 seconds." }), {
          status: 429,
        });
      const fetchFn = vi.fn(async () => limited());
      const client = new ParkCloudClient(credentials, { fetchFn, ...clock });

      await expect(client.getOperators()).rejects.toMatchObject({ status: 429 });
      expect(fetchFn).toHaveBeenCalledTimes(3);
      expect(clock.sleeps).toEqual([60_000, 60_000]);
    });
  });
});
