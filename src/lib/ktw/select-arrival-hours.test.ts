import { describe, expect, it } from "vitest";
import { selectArrivalHours } from "./select-arrival-hours";

const planned = "2026-09-16T12:00:00.000Z";

describe("selectArrivalHours", () => {
  it("returns all matching hours in scheduled order, not a single pick", () => {
    const hours = selectArrivalHours(
      [
        { originLabel: "London Luton", scheduledAt: "2026-09-16T14:30:00.000Z" },
        { originLabel: "London Stansted", scheduledAt: "2026-09-16T10:00:00.000Z" },
        { originLabel: "Dortmund", scheduledAt: "2026-09-16T12:00:00.000Z" },
        { originLabel: "London Gatwick", scheduledAt: "2026-09-16T16:00:01.000Z" },
      ],
      { flightDirection: "Londyn, LO 392", plannedCheckOut: planned }
    );

    expect(hours.map((row) => row.scheduledAt)).toEqual(["2026-09-16T10:00:00.000Z", "2026-09-16T14:30:00.000Z"]);
  });

  it("returns an empty list when direction cannot be mapped", () => {
    const board = [{ originLabel: "London Luton", scheduledAt: "2026-09-16T12:00:00.000Z" }];
    expect(selectArrivalHours(board, { flightDirection: null, plannedCheckOut: planned })).toEqual([]);
    expect(selectArrivalHours(board, { flightDirection: "departure", plannedCheckOut: planned })).toEqual([]);
    expect(selectArrivalHours(board, { flightDirection: "Narnia", plannedCheckOut: planned })).toEqual([]);
  });
});
