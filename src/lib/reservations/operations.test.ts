import { describe, expect, it } from "vitest";
import { createCheckInCommand, createCheckOutCommand } from "./operations";

describe("reservation operations", () => {
  const now = new Date("2026-09-14T10:00:00.000Z");

  it("builds a check-in command that moves the reservation to in_progress", () => {
    expect(createCheckInCommand(now)).toEqual({
      status: "in_progress",
      actual_check_in: "2026-09-14T10:00:00.000Z",
    });
  });

  it("builds a check-out command that completes the reservation", () => {
    expect(createCheckOutCommand(now)).toEqual({
      status: "completed",
      actual_check_out: "2026-09-14T10:00:00.000Z",
    });
  });
});
