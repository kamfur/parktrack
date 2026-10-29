import { UPPER, WS, field, type ExtractContext, type VoiceField } from "../types";

const PLACE = `[${UPPER}][\\p{L}-]*`;
const FLIGHT = new RegExp(
  `${WS}(?:[Ll]ot|[Ww]ylot|[Pp]rzylot|[Ll]eci|[Ll]ecą|[Kk]ierunek)\\s+(?:(?:do|z|ze|na)\\s+)?(${PLACE}(?:,?\\s+${PLACE}){0,2})`,
  "gu"
);

/** Destination as spoken ("lot do Londynu, Stansted" → "Londynu Stansted"); last mention wins. */
export function extractFlight(text: string, ctx: ExtractContext): VoiceField<string> | undefined {
  let result: VoiceField<string> | undefined;
  for (const m of text.matchAll(FLIGHT)) {
    const value = m[1].replace(/,/g, "").replace(/\s+/g, " ").slice(0, 100);
    const start = (m.index ?? 0) + m[0].length - m[1].length;
    result = field(value, [start, start + m[1].length], ctx);
  }
  return result;
}
