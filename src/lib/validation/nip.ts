const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** Strips spaces, dashes and an optional `PL` prefix: `"PL 123-456-32-18"` → `"1234563218"`. */
export function normalizeNip(input: string): string {
  return input.trim().replace(/^PL/i, "").replace(/[\s-]/g, "");
}

/**
 * Polish NIP checksum: weighted sum of the first 9 digits mod 11 equals the 10th digit
 * (a remainder of 10 is never valid).
 */
export function isValidNip(input: string): boolean {
  const nip = normalizeNip(input);
  if (!/^\d{10}$/.test(nip)) return false;

  const digits = [...nip].map(Number);
  const checksum = NIP_WEIGHTS.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11;
  return checksum !== 10 && checksum === digits[9];
}
