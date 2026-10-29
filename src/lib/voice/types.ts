import type { ParkingType } from "@/lib/pricing/parking-type";

/** A Soniox token mapped to character offsets in the final transcript. */
export interface VoiceTokenSpan {
  start: number;
  end: number;
  confidence: number;
}

export interface VoiceField<T> {
  value: T;
  /** [start, end) character offsets of the source text in the transcript. */
  span: [number, number];
  lowConfidence: boolean;
}

/** Local (browser / Warsaw) calendar date and optional time — no timezone offset. */
export interface VoiceDateTime {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm
}

export type VoicePlateField = VoiceField<string> & { formatWarning: boolean };

export interface ParsedVoiceFields {
  lastName?: VoiceField<string>;
  firstName?: VoiceField<string>;
  /** Exactly 9 digits. */
  phone?: VoiceField<string>;
  email?: VoiceField<string>;
  /** Uppercase, no spaces or hyphens. */
  licensePlate?: VoicePlateField;
  checkIn?: VoiceField<VoiceDateTime>;
  checkOut?: VoiceField<VoiceDateTime>;
  parkingType?: VoiceField<ParkingType>;
  flightDirection?: VoiceField<string>;
}

export interface ExtractContext {
  /** Today in Europe/Warsaw, YYYY-MM-DD. */
  today: string;
  isLowConfidence(span: [number, number]): boolean;
}

/** Builds a VoiceField, resolving low confidence from the context. */
export function field<T>(value: T, span: [number, number], ctx: ExtractContext): VoiceField<T> {
  return { value, span, lowConfidence: ctx.isLowConfidence(span) };
}

/** Polish uppercase / lowercase letter classes for regex sources. */
export const UPPER = "A-ZĄĆĘŁŃÓŚŹŻ";
export const LOWER = "a-ząćęłńóśźż";
/** A capitalized word, optionally hyphenated (Wiśniewska-Lis). */
export const CAP_WORD = `[${UPPER}][${LOWER}]+(?:-[${UPPER}][${LOWER}]+)?`;
/** Word-start / word-end guards that understand Polish letters (JS \b is ASCII-only). */
export const WS = "(?<![\\p{L}\\d])";
export const WE = "(?![\\p{L}\\d])";
