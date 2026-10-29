import { describe, expect, it } from "vitest";
import { formatKtwHourList } from "./format-hours";

describe("formatKtwHourList", () => {
  it("joins multiple Warsaw clock times and hides an empty field", () => {
    expect(
      formatKtwHourList([
        { scheduled_at: "2026-09-16T10:00:00.000Z", origin_label: "London Luton" },
        { scheduled_at: "2026-09-16T14:30:00.000Z", origin_label: "London Stansted" },
      ])
    ).toBe("12:00, 16:30");
    expect(formatKtwHourList(undefined)).toBeNull();
    expect(formatKtwHourList([])).toBeNull();
  });

  it("prefers the board status over the scheduled clock", () => {
    expect(
      formatKtwHourList([
        { scheduled_at: "2026-09-16T21:30:00.000Z", origin_label: "Madera", status: "PRZYLOT 00:07" },
        { scheduled_at: "2026-09-16T10:00:00.000Z", origin_label: "London Luton" },
      ])
    ).toBe("PRZYLOT 00:07, 12:00");
  });
});
