import { describe, expect, it } from "vitest";
import { POC_FIXTURES, POC_TODAY, type PocFixture } from "./fixtures/poc-transcripts";
import { repairPhoneGroups } from "./extractors/phone";
import { plateFormatWarning } from "./extractors/plate";
import { parseReservationTranscript, type ParsedVoiceFields } from "./parse-transcript";

function values(parsed: ParsedVoiceFields): PocFixture["expected"] {
  return Object.fromEntries(
    [
      ["lastName", parsed.lastName?.value],
      ["firstName", parsed.firstName?.value],
      ["phone", parsed.phone?.value],
      ["email", parsed.email?.value],
      ["licensePlate", parsed.licensePlate?.value],
      ["plateFormatWarning", parsed.licensePlate?.formatWarning || undefined],
      ["checkIn", parsed.checkIn?.value],
      ["checkOut", parsed.checkOut?.value],
      ["parkingType", parsed.parkingType?.value],
      ["flightDirection", parsed.flightDirection?.value],
    ].filter(([, v]) => v !== undefined)
  );
}

const parse = (text: string, today = POC_TODAY) => parseReservationTranscript(text, { today });

describe("parseReservationTranscript — PoC corpus", () => {
  it.each(POC_FIXTURES.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    expect(values(parse(fixture.transcript))).toEqual(fixture.expected);
  });

  it("parses at least 13 of 15 PoC transcripts fully correct", () => {
    const correct = POC_FIXTURES.filter((f) => expectEqual(values(parse(f.transcript)), f.expected));
    expect(correct.length).toBeGreaterThanOrEqual(13);
  });
});

function expectEqual(a: unknown, b: unknown): boolean {
  try {
    expect(a).toEqual(b);
    return true;
  } catch {
    return false;
  }
}

describe("dates", () => {
  it("applies a spoken correction to the same role", () => {
    const p = parse("przyjazd 15 października, nie, przepraszam, 17 października, powrót 20 października");
    expect(p.checkIn?.value).toEqual({ date: "2026-10-17", time: null });
    expect(p.checkOut?.value).toEqual({ date: "2026-10-20", time: null });
  });

  it("rolls past day/month into next year", () => {
    expect(parse("przyjazd 5 stycznia, powrót 12 stycznia", "2026-10-01").checkIn?.value.date).toBe("2027-01-05");
  });

  it("bumps check-out a year when it lands before check-in", () => {
    const p = parse("przyjazd 5 stycznia, powrót 12 stycznia", "2026-01-10");
    expect(p.checkIn?.value.date).toBe("2027-01-05");
    expect(p.checkOut?.value.date).toBe("2027-01-12");
  });

  it("drops impossible dates", () => {
    expect(parse("przyjazd 31 listopada").checkIn).toBeUndefined();
  });

  it("supports a shared-month range", () => {
    const p = parse("od 8 do 15 listopada");
    expect(p.checkIn?.value.date).toBe("2026-11-08");
    expect(p.checkOut?.value.date).toBe("2026-11-15");
  });

  it("supports relative days and bare weekdays (strictly after today)", () => {
    // 2026-10-01 is a Thursday.
    expect(parse("przyjazd pojutrze").checkIn?.value.date).toBe("2026-10-03");
    expect(parse("przyjazd w piątek, powrót w czwartek").checkIn?.value.date).toBe("2026-10-02");
    expect(parse("przyjazd w piątek, powrót w czwartek").checkOut?.value.date).toBe("2026-10-08");
  });

  it("reads evening and night modifiers", () => {
    expect(parse("przyjazd 12 października o 8 wieczorem").checkIn?.value.time).toBe("20:00");
    expect(parse("przyjazd 12 października o 10 w nocy").checkIn?.value.time).toBe("22:00");
  });

  it("does not read a passenger count as a time", () => {
    expect(parse("przyjazd 12 października, o 4 osoby więcej").checkIn?.value.time).toBeNull();
  });

  it("supports numeric dates with an explicit year", () => {
    expect(parse("przyjazd 12.10.2027").checkIn?.value.date).toBe("2027-10-12");
  });
});

describe("phone", () => {
  it("repairs split hundreds groups", () => {
    expect(repairPhoneGroups(["512", "300", "45", "678"])).toBe("512345678");
    expect(repairPhoneGroups(["700", "90", "12", "34", "56"])).toBe("790123456");
  });

  it("strips the +48 prefix", () => {
    expect(parse("telefon +48 604 123 987").phone?.value).toBe("604123987");
  });

  it("ignores numbers that are not 9 digits", () => {
    expect(parse("telefon 604 123").phone).toBeUndefined();
  });
});

describe("plate", () => {
  it("does not take a phone number after 'numer telefonu'", () => {
    expect(parse("numer telefonu 604 123 987").licensePlate).toBeUndefined();
  });

  it("warns on implausible formats only", () => {
    expect(plateFormatWarning("KR7HX29")).toBe(false);
    expect(plateFormatWarning("KCH07")).toBe(true);
    expect(plateFormatWarning("AB12345")).toBe(true); // A is not a voivodeship letter
  });
});

describe("email", () => {
  it("rebuilds a spoken address", () => {
    expect(parse("mail anna kropka nowak małpa gmail kropka com").email?.value).toBe("anna.nowak@gmail.com");
  });
});

describe("names", () => {
  it("reads surname-first order when the second word is a first name", () => {
    const p = parse("Kowalski Jan, przyjazd 12 października");
    expect(p.lastName?.value).toBe("Kowalski");
    expect(p.firstName?.value).toBe("Jan");
  });
});

describe("low confidence", () => {
  it("flags a field whose source tokens fall below the threshold", () => {
    const text = "Marek Gregorczyk, przyjazd 15 października";
    const at = text.indexOf("Greg");
    const p = parseReservationTranscript(text, {
      today: POC_TODAY,
      tokens: [{ start: at, end: at + 4, confidence: 0.63 }],
    });
    expect(p.lastName?.lowConfidence).toBe(true);
    expect(p.firstName?.lowConfidence).toBe(false);
    expect(p.checkIn?.lowConfidence).toBe(false);
  });
});
