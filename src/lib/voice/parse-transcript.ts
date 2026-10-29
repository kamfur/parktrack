import { extractDates } from "./extractors/dates";
import { extractEmail } from "./extractors/email";
import { extractFlight } from "./extractors/flight";
import { extractNames } from "./extractors/names";
import { extractParkingType } from "./extractors/parking-type";
import { extractPhone } from "./extractors/phone";
import { extractPlate } from "./extractors/plate";
import type { ExtractContext, ParsedVoiceFields, VoiceTokenSpan } from "./types";

export type { ParsedVoiceFields, VoiceDateTime, VoiceField, VoicePlateField, VoiceTokenSpan } from "./types";

export interface ParseOptions {
  /** Today in Europe/Warsaw, YYYY-MM-DD (`warsawDateKey(new Date())`). */
  today: string;
  /** Final Soniox tokens with offsets into `transcript`, for low-confidence flags. */
  tokens?: VoiceTokenSpan[];
  /** @default 0.7 */
  lowConfidenceBelow?: number;
}

/**
 * Turns the whole accumulated final Soniox transcript into reservation fields.
 * Always re-parse the full transcript: the latest mention of each field wins, which is
 * how spoken corrections ("nie, przepraszam, 17 października") take effect.
 */
export function parseReservationTranscript(transcript: string, opts: ParseOptions): ParsedVoiceFields {
  const threshold = opts.lowConfidenceBelow ?? 0.7;
  const tokens = opts.tokens ?? [];
  const ctx: ExtractContext = {
    today: opts.today,
    isLowConfidence: ([start, end]) => tokens.some((t) => t.start < end && t.end > start && t.confidence < threshold),
  };

  const parsed: ParsedVoiceFields = {
    ...extractNames(transcript, ctx),
    phone: extractPhone(transcript, ctx),
    email: extractEmail(transcript, ctx),
    licensePlate: extractPlate(transcript, ctx),
    ...extractDates(transcript, ctx),
    parkingType: extractParkingType(transcript, ctx),
    flightDirection: extractFlight(transcript, ctx),
  };
  // Drop undefined keys so callers can iterate with Object.entries.
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as ParsedVoiceFields;
}
