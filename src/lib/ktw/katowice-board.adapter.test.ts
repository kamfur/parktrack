import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  arrivalsRequestUrl,
  createKatowiceBoardAdapter,
  DEFAULT_KTW_ARRIVALS_URL,
  parseKatowiceBoardPayload,
} from "./katowice-board.adapter";
import { KtwArrivalsError } from "./ktw-arrivals.port";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/katowice-board.json"), "utf8");
const now = new Date("2026-09-16T12:00:00.000Z");

describe("parseKatowiceBoardPayload", () => {
  it("reads origin and Warsaw scheduled instants from the official list fixture", () => {
    expect(parseKatowiceBoardPayload(fixture, now)).toEqual([
      { originLabel: "Londyn - Luton", scheduledAt: "2026-09-16T08:00:00.000Z" },
      { originLabel: "Londyn - Stansted", scheduledAt: "2026-09-16T12:30:00.000Z" },
      { originLabel: "Dortmund", scheduledAt: "2026-09-16T10:00:00.000Z" },
      { originLabel: "Londyn - Gatwick", scheduledAt: "2026-09-16T16:00:00.000Z" },
    ]);
  });

  it("keeps the Gatwick arrival and drops the Gatwick departure", () => {
    const gatwick = parseKatowiceBoardPayload(fixture, now).filter((row) => row.originLabel === "Londyn - Gatwick");
    expect(gatwick).toEqual([{ originLabel: "Londyn - Gatwick", scheduledAt: "2026-09-16T16:00:00.000Z" }]);
  });

  it("accepts an arrivals array with ISO scheduledAt", () => {
    const body = JSON.stringify({
      arrivals: [{ originLabel: "London Luton", scheduledAt: "2026-09-16T10:00:00.000Z" }],
    });
    expect(parseKatowiceBoardPayload(body, now)).toEqual([
      { originLabel: "London Luton", scheduledAt: "2026-09-16T10:00:00.000Z" },
    ]);
  });

  it("returns an empty list for a successful empty board", () => {
    expect(parseKatowiceBoardPayload(JSON.stringify({ data: [] }), now)).toEqual([]);
  });

  it("throws a typed error when the payload is not a board", () => {
    expect(() => parseKatowiceBoardPayload("<html>Tablica lotów</html>", now)).toThrow(KtwArrivalsError);
    expect(() => parseKatowiceBoardPayload("", now)).toThrow(KtwArrivalsError);
    expect(() => parseKatowiceBoardPayload(JSON.stringify({ foo: 1 }), now)).toThrow(KtwArrivalsError);
  });
});

describe("arrivalsRequestUrl", () => {
  it("adds arrival direction and the Warsaw calendar date", () => {
    const url = new URL(arrivalsRequestUrl(DEFAULT_KTW_ARRIVALS_URL, now));
    expect(url.searchParams.get("direction")).toBe("2");
    expect(url.searchParams.get("date")).toBe("2026-09-16");
  });
});

describe("createKatowiceBoardAdapter", () => {
  it("parses a fixture response without calling the network", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fixture,
    });
    const port = createKatowiceBoardAdapter({ fetchImpl, url: "https://board.test/list" });
    const rows = await port.listArrivals(now);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const requested = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requested).toContain("direction=2");
    expect(requested).toContain("date=2026-09-16");
    expect(rows).toHaveLength(4);
  });

  it("throws a typed error on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" });
    const port = createKatowiceBoardAdapter({ fetchImpl, url: "https://board.test/list" });
    await expect(port.listArrivals(now)).rejects.toBeInstanceOf(KtwArrivalsError);
  });
});
