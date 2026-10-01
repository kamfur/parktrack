import type { ParsedVoiceFields } from "./types";

export type Provenance = "empty" | "voice" | "manual";
export type VoiceFieldKey = keyof ParsedVoiceFields;
export type ProvenanceMap = Partial<Record<VoiceFieldKey, Provenance>>;

/** Parser-domain values last applied to the form, keyed like ParsedVoiceFields. */
export type AppliedVoiceValues = Partial<Record<VoiceFieldKey, unknown>>;

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Picks the parsed fields voice may write: never over a `manual` field, and only when the value
 * changed since it was last applied. `current` holds parser-domain values (not form values), so
 * callers keep the last applied `field.value` per key.
 */
export function planVoiceUpdates(
  parsed: ParsedVoiceFields,
  provenance: ProvenanceMap,
  current: AppliedVoiceValues
): { updates: Partial<ParsedVoiceFields>; nextProvenance: ProvenanceMap } {
  const updates: Partial<ParsedVoiceFields> = {};
  const nextProvenance: ProvenanceMap = { ...provenance };
  for (const key of Object.keys(parsed) as VoiceFieldKey[]) {
    const parsedField = parsed[key];
    if (!parsedField || provenance[key] === "manual") continue;
    if (sameValue(current[key], parsedField.value)) continue;
    Object.assign(updates, { [key]: parsedField });
    nextProvenance[key] = "voice";
  }
  return { updates, nextProvenance };
}

/**
 * A voice-filled plate blocks submit until the user confirms it. A manual edit counts as
 * confirmation; callers reset `confirmed` to false whenever voice changes the plate.
 */
export function plateNeedsConfirmation(provenance: ProvenanceMap, confirmed: boolean): boolean {
  return provenance.licensePlate === "voice" && !confirmed;
}
