import { beforeEach, describe, expect, it, vi } from "vitest";

const { runParkViaSync } = vi.hoisted(() => ({ runParkViaSync: vi.fn() }));

vi.mock("../../../../lib/parkvia/scheduler", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/parkvia/scheduler")>(
    "../../../../lib/parkvia/scheduler"
  );
  return { ...actual, runParkViaSync };
});

import { ParkViaNotConfiguredError, ParkViaSyncBusyError } from "../../../../lib/parkvia/scheduler";
import { POST } from "./sync";

const ctx = {} as Parameters<typeof POST>[0];

describe("POST /api/integrations/parkvia/sync", () => {
  beforeEach(() => {
    runParkViaSync.mockReset();
  });

  it("returns the run summary", async () => {
    runParkViaSync.mockResolvedValue({ operators: ["1500"], inserted: 2 });
    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ operators: ["1500"], inserted: 2 });
  });

  it("returns 409 while another run is in progress", async () => {
    runParkViaSync.mockRejectedValue(new ParkViaSyncBusyError());
    expect((await POST(ctx)).status).toBe(409);
  });

  it("returns 503 when keys are missing", async () => {
    runParkViaSync.mockRejectedValue(new ParkViaNotConfiguredError("PARKCLOUD_API_KEY"));
    expect((await POST(ctx)).status).toBe(503);
  });

  it("returns 502 with a generic message when ParkCloud or the DB fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    runParkViaSync.mockRejectedValue(new Error("ParkCloud answered 500: secret details"));
    const res = await POST(ctx);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret details");
  });
});
