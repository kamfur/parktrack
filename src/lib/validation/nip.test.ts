import { describe, expect, it } from "vitest";
import { isValidNip, normalizeNip } from "./nip";

describe("normalizeNip", () => {
  it.each([
    ["1234563218", "1234563218"],
    ["123-456-32-18", "1234563218"],
    ["123 456 32 18", "1234563218"],
    ["PL1234563218", "1234563218"],
    [" pl 123-45-63-218 ", "1234563218"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeNip(input)).toBe(expected);
  });
});

describe("isValidNip", () => {
  it.each(["1234563218", "123-456-32-18", "PL 1234563218", "5260250274"])("accepts valid NIP %s", (nip) => {
    expect(isValidNip(nip)).toBe(true);
  });

  it.each([
    ["wrong check digit", "1234563219"],
    ["too short", "123456321"],
    ["too long", "12345632180"],
    ["letters", "12345632AB"],
    ["empty", ""],
    // weighted sum mod 11 = 10 → never valid
    ["checksum remainder 10", "1234567890"],
  ])("rejects %s", (_label, nip) => {
    expect(isValidNip(nip)).toBe(false);
  });
});
