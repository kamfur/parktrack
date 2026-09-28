import { describe, expect, it } from "vitest";
import { saveTravelAgencySchema } from "./travel-agency.schema";

const valid = {
  name: "  Biuro Słońce  ",
  nip: "PL 123-456-32-18",
  address: "ul. Morska 1, Gdańsk",
  email: "",
  phone: " ",
  contact_person: undefined,
  notes: null,
  discount_pct: 15,
  payment_term_days: 14,
};

describe("saveTravelAgencySchema", () => {
  it("normalizes NIP, trims text and turns empty optionals into null", () => {
    const parsed = saveTravelAgencySchema.parse(valid);
    expect(parsed).toEqual({
      name: "Biuro Słońce",
      nip: "1234563218",
      address: "ul. Morska 1, Gdańsk",
      email: null,
      phone: null,
      contact_person: null,
      notes: null,
      discount_pct: 15,
      payment_term_days: 14,
    });
  });

  it("rejects an invalid NIP checksum with a Polish message", () => {
    const result = saveTravelAgencySchema.safeParse({ ...valid, nip: "1234563219" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.nip?.[0]).toMatch(/Nieprawidłowy NIP/);
  });

  it.each([
    ["discount below 0", { discount_pct: -1 }],
    ["discount above 100", { discount_pct: 100.5 }],
    ["discount with 3 decimals", { discount_pct: 10.005 }],
    ["fractional payment term", { payment_term_days: 7.5 }],
    ["payment term above 365", { payment_term_days: 366 }],
    ["missing name", { name: "   " }],
    ["missing address", { address: "" }],
    ["bad email", { email: "not-an-email" }],
  ])("rejects %s", (_label, override) => {
    expect(saveTravelAgencySchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("accepts a 0% discount and a valid email", () => {
    const parsed = saveTravelAgencySchema.parse({ ...valid, discount_pct: 0, email: "biuro@example.pl" });
    expect(parsed.discount_pct).toBe(0);
    expect(parsed.email).toBe("biuro@example.pl");
  });
});
