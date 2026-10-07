import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  arrivalsRequestUrl,
  assertAllowedKtwArrivalsUrl,
  boardDateKeys,
  createKatowiceBoardAdapter,
  DEFAULT_KTW_ARRIVALS_URL,
  MAX_PARSED_BOARD_ROWS,
  OFFICIAL_KTW_BOARD_PAGE,
  parseKatowiceBoardPayload,
} from "./katowice-board.adapter";
import { KtwArrivalsError } from "./ktw-arrivals.port";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/katowice-board.json"), "utf8");
const now = new Date("2026-09-16T12:00:00.000Z");

describe("parseKatowiceBoardPayload", () => {
  it("reads origin and Warsaw scheduled instants from the official list fixture", () => {
    expect(parseKatowiceBoardPayload(fixture, now)).toEqual([
      { originLabel: "Londyn - Luton", scheduledAt: "2026-09-16T08:00:00.000Z", status: "WYLĄDOWAŁ 10:12" },
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

  it("pins clock times to the board calendar day so 00:10 after midnight stays next day", () => {
    const body = JSON.stringify({
      data: [{ direction: 2, scheduled_time: "00:10", airport: "Madera", status: "PRZYLOT 00:10" }],
    });
    expect(parseKatowiceBoardPayload(body, "2026-09-17")).toEqual([
      { originLabel: "Madera", scheduledAt: "2026-09-16T22:10:00.000Z", status: "PRZYLOT 00:10" },
    ]);
  });

  it("throws a typed error when the payload is not a board", () => {
    expect(() => parseKatowiceBoardPayload("<html>Tablica lotów</html>", now)).toThrow(KtwArrivalsError);
    expect(() => parseKatowiceBoardPayload("", now)).toThrow(KtwArrivalsError);
    expect(() => parseKatowiceBoardPayload(JSON.stringify({ foo: 1 }), now)).toThrow(KtwArrivalsError);
  });

  it("caps parsed rows so a huge payload stays bounded", () => {
    const data = Array.from({ length: MAX_PARSED_BOARD_ROWS + 1 }, (_, index) => ({
      direction: 2,
      scheduled_time: "12:00",
      airport: `Origin ${index}`,
    }));
    expect(parseKatowiceBoardPayload(JSON.stringify({ data }), now)).toHaveLength(MAX_PARSED_BOARD_ROWS);
  });
});

describe("assertAllowedKtwArrivalsUrl", () => {
  it("keeps the official list URL and remaps the public board page", () => {
    expect(assertAllowedKtwArrivalsUrl(DEFAULT_KTW_ARRIVALS_URL)).toBe(DEFAULT_KTW_ARRIVALS_URL);
    expect(assertAllowedKtwArrivalsUrl(OFFICIAL_KTW_BOARD_PAGE)).toBe(DEFAULT_KTW_ARRIVALS_URL);
  });

  it("rejects non-https and non-KTW hosts", () => {
    expect(() => assertAllowedKtwArrivalsUrl("http://www.katowice-airport.com/pl/api/flight-board/list")).toThrow(
      KtwArrivalsError
    );
    expect(() => assertAllowedKtwArrivalsUrl("https://example.com/list")).toThrow(KtwArrivalsError);
  });
});

describe("arrivalsRequestUrl", () => {
  it("adds arrival direction and the given Warsaw calendar date", () => {
    const url = new URL(arrivalsRequestUrl(DEFAULT_KTW_ARRIVALS_URL, "2026-09-17"));
    expect(url.searchParams.get("direction")).toBe("2");
    expect(url.searchParams.get("date")).toBe("2026-09-17");
  });
});

describe("boardDateKeys", () => {
  it("covers yesterday, today, and tomorrow in Warsaw", () => {
    expect(boardDateKeys(now)).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
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

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const requested = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(requested.some((url) => url.includes("date=2026-09-15"))).toBe(true);
    expect(requested.some((url) => url.includes("date=2026-09-16"))).toBe(true);
    expect(requested.some((url) => url.includes("date=2026-09-17"))).toBe(true);
    expect(rows).toHaveLength(12);
  });

  it("throws a typed error on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" });
    const port = createKatowiceBoardAdapter({ fetchImpl, url: "https://board.test/list" });
    await expect(port.listArrivals(now)).rejects.toBeInstanceOf(KtwArrivalsError);
  });
});
