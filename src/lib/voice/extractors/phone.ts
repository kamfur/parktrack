import { WS, field, type ExtractContext, type VoiceField } from "../types";

const PHONE_KEYWORD = new RegExp(
  `${WS}(?:numer\\s+telefonu|nr\\s+telefonu|telefon(?:u|iczny)?|tel\\.?|komórk[aiy]|komórkowy)\\s*:?\\s*`,
  "giu"
);
const DIGIT_GROUPS = /^(\+?\s?48[\s-]+)?(\d{1,9}(?:[\s-]+\d{1,9})*)/u;

/**
 * Soniox sometimes writes a spoken group as two groups: "trzysta czterdzieści pięć" → "300 45",
 * "siedemset dziewięćdziesiąt" → "700 90". Merge X00+YY and X0+Y back.
 */
export function repairPhoneGroups(groups: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const next = groups[i + 1];
    if (next && /^\d00$/.test(g) && /^[1-9]\d$/.test(next)) {
      out.push(g[0] + next);
      i++;
    } else if (next && /^\d0$/.test(g) && /^[1-9]$/.test(next)) {
      out.push(g[0] + next);
      i++;
    } else {
      out.push(g);
    }
  }
  return out.join("");
}

function normalize(groups: string[]): string | undefined {
  const candidates = [groups.join(""), repairPhoneGroups(groups)];
  for (let digits of candidates) {
    if (digits.length === 11 && digits.startsWith("48")) digits = digits.slice(2);
    if (digits.length === 9) return digits;
  }
  return undefined;
}

/** Last phone number spoken after a phone keyword, as exactly 9 digits. */
export function extractPhone(text: string, ctx: ExtractContext): VoiceField<string> | undefined {
  let result: VoiceField<string> | undefined;
  for (const kw of text.matchAll(PHONE_KEYWORD)) {
    const from = (kw.index ?? 0) + kw[0].length;
    const m = DIGIT_GROUPS.exec(text.slice(from));
    if (!m) continue;
    const digits = normalize(m[2].split(/[\s-]+/));
    if (!digits) continue;
    const start = from + (m[1]?.length ?? 0);
    result = field(digits, [start, from + m[0].length], ctx);
  }
  return result;
}
