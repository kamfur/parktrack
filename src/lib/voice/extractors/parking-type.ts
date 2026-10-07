import type { ParkingType } from "@/lib/pricing/parking-type";
import { WE, WS, field, type ExtractContext, type VoiceField } from "../types";

const PARKING_WORDS = new RegExp(`${WS}(garaż\\p{L}*|wiat(?:a|y|ę|ą|cie)|zadaszon\\p{L}*|odkryt\\p{L}*)${WE}`, "giu");

function toType(word: string): ParkingType {
  const w = word.toLowerCase();
  if (w.startsWith("garaż")) return "garage";
  if (w.startsWith("odkryt")) return "open_air";
  return "carport";
}

/** Last mention wins ("parking odkryty, a nie, jednak wiata" → carport). */
export function extractParkingType(text: string, ctx: ExtractContext): VoiceField<ParkingType> | undefined {
  let result: VoiceField<ParkingType> | undefined;
  for (const m of text.matchAll(PARKING_WORDS)) {
    result = field(toType(m[1]), [m.index ?? 0, (m.index ?? 0) + m[0].length], ctx);
  }
  return result;
}
