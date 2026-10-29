import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, toStaffFormWrites, voiceDateToLocalDate } from "./apply-to-staff-form";
import { planVoiceUpdates } from "./merge";
import { parseReservationTranscript } from "./parse-transcript";

const parse = (text: string) => parseReservationTranscript(text, { today: "2026-10-01" });

describe("voiceDateToLocalDate", () => {
  it("uses the spoken time", () => {
    const d = voiceDateToLocalDate({ date: "2026-10-12", time: "06:30" }, null);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 12, 6, 30]);
  });

  it("keeps the current time when none was spoken", () => {
    const current = new Date(2026, 9, 1, 14, 45);
    const d = voiceDateToLocalDate({ date: "2026-10-12", time: null }, current);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([12, 14, 45]);
  });

  it("falls back to midnight without a current value", () => {
    const d = voiceDateToLocalDate({ date: "2026-10-12", time: null }, undefined);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe("toStaffFormWrites", () => {
  it("maps voice fields to staff form fields and formats the phone", () => {
    const parsed = parse(
      "pan Tomasz Wróblewski, telefon 604 123 987, przyjazd 12 października o 6 rano, rejestracja KR 7HX29, garaż"
    );
    const writes = toStaffFormWrites(parsed, () => null);
    const byField = Object.fromEntries(writes.map((w) => [w.field, w.value]));
    expect(byField).toMatchObject({
      lastName: "Wróblewski",
      firstName: "Tomasz",
      phone: "604 123 987",
      licensePlate: "KR7HX29",
      parkingType: "garage",
    });
    expect((byField.checkInDate as Date).getHours()).toBe(6);
  });

  it("writes nothing for a manual field (via planVoiceUpdates)", () => {
    const { updates } = planVoiceUpdates(parse("pan Tomasz Wróblewski"), { lastName: "manual" }, {});
    const fields = toStaffFormWrites(updates, () => null).map((w) => w.field);
    expect(fields).not.toContain("lastName");
    expect(fields).toContain("firstName");
  });
});

describe("formatPhoneDisplay", () => {
  it("groups 9 digits", () => {
    expect(formatPhoneDisplay("604123987")).toBe("604 123 987");
  });
});
