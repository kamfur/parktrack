import { describe, expect, it } from "vitest";
import { toDriverFormWrites, voiceDateToDatetimeLocal } from "./apply-to-driver-form";
import { parseReservationTranscript } from "./parse-transcript";

const parse = (text: string) => parseReservationTranscript(text, { today: "2026-10-01" });

describe("voiceDateToDatetimeLocal", () => {
  it("uses the spoken time", () => {
    expect(voiceDateToDatetimeLocal({ date: "2026-10-12", time: "06:30" }, "2026-10-01T09:15")).toBe(
      "2026-10-12T06:30"
    );
  });

  it("keeps the current time when none was spoken", () => {
    expect(voiceDateToDatetimeLocal({ date: "2026-10-12", time: null }, "2026-10-01T09:15")).toBe("2026-10-12T09:15");
  });

  it("falls back to midnight for an empty field", () => {
    expect(voiceDateToDatetimeLocal({ date: "2026-10-12", time: null }, "")).toBe("2026-10-12T00:00");
  });
});

describe("toDriverFormWrites", () => {
  it("maps fields, formats the phone and drops email", () => {
    const parsed = parse(
      "Pani Agnieszka Szczepańska, telefon 604 123 987, mail a.b@c.pl, rejestracja SK4R27A. Od 3 listopada do 10 listopada, garaż."
    );
    const writes = toDriverFormWrites(parsed, (f) => (f === "checkIn" ? "2026-10-01T08:00" : ""));
    expect(Object.fromEntries(writes.map((w) => [w.field, w.value]))).toEqual({
      lastName: "Szczepańska",
      firstName: "Agnieszka",
      phone: "604 123 987",
      licensePlate: "SK4R27A",
      checkIn: "2026-11-03T08:00",
      checkOut: "2026-11-10T00:00",
      parkingType: "garage",
    });
  });
});
