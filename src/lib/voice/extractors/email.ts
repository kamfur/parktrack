import { field, type ExtractContext, type VoiceField } from "../types";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
/** "anna kropka nowak małpa gmail kropka com" — when Soniox did not normalize the address. */
const SPOKEN_EMAIL = /([a-z0-9]+(?:\s+kropka\s+[a-z0-9]+)*)\s+małpa\s+([a-z0-9]+(?:\s+kropka\s+[a-z0-9]+)+)/giu;

export function extractEmail(text: string, ctx: ExtractContext): VoiceField<string> | undefined {
  let result: VoiceField<string> | undefined;
  for (const m of text.matchAll(EMAIL)) {
    const value = m[0].replace(/\.+$/, "").toLowerCase();
    result = field(value, [m.index ?? 0, (m.index ?? 0) + value.length], ctx);
  }
  if (result) return result;
  for (const m of text.matchAll(SPOKEN_EMAIL)) {
    const join = (s: string) => s.split(/\s+kropka\s+/i).join(".");
    const value = `${join(m[1])}@${join(m[2])}`.toLowerCase();
    result = field(value, [m.index ?? 0, (m.index ?? 0) + m[0].length], ctx);
  }
  return result;
}
