import { describe, expect, it } from "vitest";
import { planVoiceUpdates, plateNeedsConfirmation } from "./merge";
import { parseReservationTranscript } from "./parse-transcript";

const parse = (text: string) => parseReservationTranscript(text, { today: "2026-10-01" });

describe("planVoiceUpdates", () => {
  it("fills empty fields and marks them as voice", () => {
    const { updates, nextProvenance } = planVoiceUpdates(parse("pan Tomasz Wróblewski, garaż"), {}, {});
    expect(updates.lastName?.value).toBe("Wróblewski");
    expect(updates.parkingType?.value).toBe("garage");
    expect(nextProvenance).toMatchObject({ lastName: "voice", firstName: "voice", parkingType: "voice" });
  });

  it("never overwrites a manual field", () => {
    const { updates, nextProvenance } = planVoiceUpdates(
      parse("pan Tomasz Wróblewski"),
      { lastName: "manual" },
      { lastName: "Kowalski" }
    );
    expect(updates.lastName).toBeUndefined();
    expect(updates.firstName?.value).toBe("Tomasz");
    expect(nextProvenance.lastName).toBe("manual");
  });

  it("lets voice overwrite an earlier voice value (spoken correction)", () => {
    const { updates } = planVoiceUpdates(
      parse("przyjazd 15 października, nie, przepraszam, 17 października"),
      { checkIn: "voice" },
      { checkIn: { date: "2026-10-15", time: null } }
    );
    expect(updates.checkIn?.value).toEqual({ date: "2026-10-17", time: null });
  });

  it("skips values that did not change since last applied", () => {
    const { updates } = planVoiceUpdates(parse("garaż"), { parkingType: "voice" }, { parkingType: "garage" });
    expect(updates).toEqual({});
  });
});

describe("plateNeedsConfirmation", () => {
  it("blocks only an unconfirmed voice plate", () => {
    expect(plateNeedsConfirmation({ licensePlate: "voice" }, false)).toBe(true);
    expect(plateNeedsConfirmation({ licensePlate: "voice" }, true)).toBe(false);
    expect(plateNeedsConfirmation({ licensePlate: "manual" }, false)).toBe(false);
    expect(plateNeedsConfirmation({}, false)).toBe(false);
  });

  it("requires a fresh confirmation after voice changes the plate", () => {
    // Caller contract: when planVoiceUpdates returns a licensePlate update, reset confirmed to false.
    const { updates, nextProvenance } = planVoiceUpdates(
      parse("rejestracja KR 7HX29"),
      { licensePlate: "voice" },
      { licensePlate: "KR7HX28" }
    );
    const confirmed = updates.licensePlate ? false : true;
    expect(plateNeedsConfirmation(nextProvenance, confirmed)).toBe(true);
  });
});
