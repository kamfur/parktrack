import { describe, expect, it } from "vitest";
import type { KtwArrivalsPort } from "../ktw/ktw-arrivals.port";
import { KtwArrivalsError } from "../ktw/ktw-arrivals.port";
import { enrichDepartureLists, enrichDepartures } from "./ktw-arrival-hours.service";

const planned = "2026-09-16T12:00:00.000Z";
const now = new Date("2026-09-16T12:00:00.000Z");

const twoOrigins: KtwArrivalsPort = {
  listArrivals: async () => [
    { originLabel: "London Luton", scheduledAt: "2026-09-16T10:00:00.000Z" },
    { originLabel: "London Stansted", scheduledAt: "2026-09-16T14:30:00.000Z" },
    { originLabel: "Dortmund", scheduledAt: "2026-09-16T12:00:00.000Z" },
    { originLabel: "London Gatwick", scheduledAt: "2026-09-16T16:00:01.000Z" },
  ],
};

describe("enrichDepartures", () => {
  it("attaches in-window hours for a matching origin and omits hours on unmatched rows", async () => {
    const rows = [
      { id: "match", flight_direction: "Londyn, LO 392", planned_check_out: planned },
      { id: "skip", flight_direction: "Narnia", planned_check_out: planned },
    ];

    const enriched = await enrichDepartures(rows, now, twoOrigins);

    expect(enriched.map((row) => row.id)).toEqual(["match", "skip"]);
    expect(enriched[0]?.ktw_arrival_hours).toEqual([
      { scheduled_at: "2026-09-16T10:00:00.000Z", origin_label: "London Luton" },
      { scheduled_at: "2026-09-16T14:30:00.000Z", origin_label: "London Stansted" },
    ]);
    expect(enriched[1]?.ktw_arrival_hours).toBeUndefined();
  });

  it("keeps row count and omits hours when the port throws", async () => {
    const rows = [
      { id: "a", flight_direction: "Londyn", planned_check_out: planned },
      { id: "b", flight_direction: "Dortmund", planned_check_out: planned },
    ];
    const failing: KtwArrivalsPort = {
      listArrivals: async () => {
        throw new KtwArrivalsError("board down");
      },
    };

    const enriched = await enrichDepartures(rows, now, failing);

    expect(enriched).toHaveLength(2);
    expect(enriched.map((row) => row.id)).toEqual(["a", "b"]);
    expect(enriched.every((row) => row.ktw_arrival_hours === undefined)).toBe(true);
  });

  it("attaches a post-midnight arrival to a 23:00 planned return", async () => {
    const port: KtwArrivalsPort = {
      listArrivals: async () => [
        { originLabel: "Madera", scheduledAt: "2026-09-16T22:10:00.000Z", status: "PRZYLOT 00:10" },
      ],
    };
    const enriched = await enrichDepartures(
      [{ id: "madera", flight_direction: "Madera", planned_check_out: "2026-09-16T21:00:00.000Z" }],
      now,
      port
    );
    expect(enriched[0]?.ktw_arrival_hours).toEqual([
      { scheduled_at: "2026-09-16T22:10:00.000Z", origin_label: "Madera", status: "PRZYLOT 00:10" },
    ]);
  });

  it("does not call the port for an empty list", async () => {
    let called = false;
    const port: KtwArrivalsPort = {
      listArrivals: async () => {
        called = true;
        return [];
      },
    };

    await expect(enrichDepartures([], now, port)).resolves.toEqual([]);
    expect(called).toBe(false);
  });
});

describe("enrichDepartureLists", () => {
  it("fetches the board once and attaches hours to pending and handled", async () => {
    let calls = 0;
    const port: KtwArrivalsPort = {
      listArrivals: async () => {
        calls += 1;
        return [{ originLabel: "London Luton", scheduledAt: "2026-09-16T10:00:00.000Z" }];
      },
    };

    const result = await enrichDepartureLists(
      [{ id: "pending", flight_direction: "Londyn", planned_check_out: planned }],
      [{ id: "handled", flight_direction: "Londyn", planned_check_out: planned }],
      now,
      port
    );

    expect(calls).toBe(1);
    expect(result.data[0]?.ktw_arrival_hours).toEqual([
      { scheduled_at: "2026-09-16T10:00:00.000Z", origin_label: "London Luton" },
    ]);
    expect(result.handled[0]?.ktw_arrival_hours).toEqual([
      { scheduled_at: "2026-09-16T10:00:00.000Z", origin_label: "London Luton" },
    ]);
  });

  it("does not call the port when both lists are empty", async () => {
    let called = false;
    const port: KtwArrivalsPort = {
      listArrivals: async () => {
        called = true;
        return [];
      },
    };

    await expect(enrichDepartureLists([], [], now, port)).resolves.toEqual({ data: [], handled: [] });
    expect(called).toBe(false);
  });
});
