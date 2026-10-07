import { PLATE_FIRST_LETTERS } from "../data/plate-prefixes";
import { WE, WS, type ExtractContext, type VoicePlateField } from "../types";

const KEYWORDS =
  "numer\\s+rejestracyjny|nr\\s+rejestracyjny|rejestracj[aiy]|rejestracyjny|tablic[aey]|samochód|auto|numer|nr";
const PLATE_KEYWORD = new RegExp(`${WS}(?:${KEYWORDS})${WE}`, "giu");
const KEYWORD_ONLY = new RegExp(`^(?:${KEYWORDS})$`, "iu");
const PLATE_TOKEN = /^[A-Z0-9][A-Z0-9-]*$/u;

/** Non-blocking sanity check: voivodeship letter, 6–8 chars, at least one digit. */
export function plateFormatWarning(plate: string): boolean {
  return !(/^[A-Z][A-Z0-9]{5,7}$/u.test(plate) && /\d/u.test(plate) && PLATE_FIRST_LETTERS.has(plate[0]));
}

/**
 * Uppercase alphanumeric tokens after a plate keyword, up to the next , . ; ! ? or dash.
 * Soniox already uppercases plates ("KR 7HX29", "SB-552R", "DW: 23 7F").
 */
export function extractPlate(text: string, ctx: ExtractContext): VoicePlateField | undefined {
  let result: VoicePlateField | undefined;
  for (const kw of text.matchAll(PLATE_KEYWORD)) {
    const from = (kw.index ?? 0) + kw[0].length;
    const segment = /^[^,.;!?—–]*/u.exec(text.slice(from))?.[0] ?? "";
    const tokens = [...segment.matchAll(/[^\s:]+/gu)];
    let i = 0;
    while (i < tokens.length && KEYWORD_ONLY.test(tokens[i][0])) i++;
    const plateTokens = [];
    for (; i < tokens.length && PLATE_TOKEN.test(tokens[i][0]); i++) plateTokens.push(tokens[i]);
    if (!plateTokens.length) continue;

    const value = plateTokens
      .map((t) => t[0])
      .join("")
      .replace(/-/g, "");
    if (value.length < 4 || value.length > 10 || !/\d/u.test(value) || !/[A-Z]/u.test(value)) continue;

    const last = plateTokens[plateTokens.length - 1];
    const span: [number, number] = [from + (plateTokens[0].index ?? 0), from + (last.index ?? 0) + last[0].length];
    result = { value, span, lowConfidence: ctx.isLowConfidence(span), formatWarning: plateFormatWarning(value) };
  }
  return result;
}
