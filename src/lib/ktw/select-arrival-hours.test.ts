import { describe, expect, it } from "vitest";
import { selectArrivalHours } from "./select-arrival-hours";

const planned = "2026-09-16T12:00:00.000Z";

describe("selectArrivalHours", () => {
  it("returns matching hours in scheduled order, not a single pick", () => {
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

  it("keeps only the 3 hours closest to planned return", () => {
    const hours = selectArrivalHours(
      [
        { originLabel: "London Luton", scheduledAt: "2026-09-16T09:00:00.000Z" },
        { originLabel: "London Stansted", scheduledAt: "2026-09-16T10:00:00.000Z" },
        { originLabel: "London Gatwick", scheduledAt: "2026-09-16T11:00:00.000Z" },
        { originLabel: "London Heathrow", scheduledAt: "2026-09-16T12:00:00.000Z" },
        { originLabel: "London Luton", scheduledAt: "2026-09-16T13:00:00.000Z" },
        { originLabel: "London Stansted", scheduledAt: "2026-09-16T14:30:00.000Z" },
      ],
      { flightDirection: "Londyn", plannedCheckOut: planned }
    );

    expect(hours.map((row) => row.scheduledAt)).toEqual([
      "2026-09-16T11:00:00.000Z",
      "2026-09-16T12:00:00.000Z",
      "2026-09-16T13:00:00.000Z",
    ]);
  });

  it("keeps a 00:10 next-day arrival against a 23:00 planned return", () => {
    const hours = selectArrivalHours(
      [{ originLabel: "Madera", scheduledAt: "2026-09-16T22:10:00.000Z", status: "PRZYLOT 00:10" }],
      {
        flightDirection: "Madera",
        plannedCheckOut: "2026-09-16T21:00:00.000Z",
      }
    );
    expect(hours).toEqual([
      { scheduledAt: "2026-09-16T22:10:00.000Z", originLabel: "Madera", status: "PRZYLOT 00:10" },
    ]);
  });

  it("returns an empty list when direction cannot be mapped", () => {
    const board = [{ originLabel: "London Luton", scheduledAt: "2026-09-16T12:00:00.000Z" }];
    expect(selectArrivalHours(board, { flightDirection: null, plannedCheckOut: planned })).toEqual([]);
    expect(selectArrivalHours(board, { flightDirection: "departure", plannedCheckOut: planned })).toEqual([]);
    expect(selectArrivalHours(board, { flightDirection: "Narnia", plannedCheckOut: planned })).toEqual([]);
  });
});
