import { FIRST_NAMES } from "../data/first-names";
import { CAP_WORD, WS, field, type ExtractContext, type VoiceField } from "../types";

export interface NameFields {
  lastName?: VoiceField<string>;
  firstName?: VoiceField<string>;
}

interface Word {
  text: string;
  start: number;
}

/** Capitalized words that open a clause but are never names. */
const STOPWORDS = new Set(
  `dobrze to tak więc okej ok halo dzień pan pani państwo numer rejestracja rejestracyjny telefon mail email
   przyjazd powrót parking wiata garaż od do lot wylot przylot samochód auto imię nazwisko literuję nie a
   eee yyy moment jednak godzina jutro pojutrze dzisiaj dziś przepraszam proszę dziękuję osoby osób kierunek`
    .split(/\s+/)
    .filter(Boolean)
);

const LAST_NAME_RE = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]{2,100}$/;

function lastOf(re: RegExp, text: string): RegExpExecArray | undefined {
  let last: RegExpExecArray | undefined;
  for (const m of text.matchAll(re)) last = m;
  return last;
}

/** Splits a run of capitalized words into first + last name using the first-name dictionary. */
function assign(words: Word[]): { first?: Word; last?: Word[] } {
  if (words.length === 1) return { last: words };
  const firstIdx = words.findIndex((w) => FIRST_NAMES.has(w.text));
  const idx = firstIdx === -1 ? 0 : firstIdx;
  return { first: words[idx], last: words.filter((_, i) => i !== idx) };
}

function toFields(words: Word[], ctx: ExtractContext): NameFields {
  const { first, last } = assign(words);
  const out: NameFields = {};
  if (last?.length) {
    const value = last.map((w) => w.text).join(" ");
    if (LAST_NAME_RE.test(value)) {
      const end = last[last.length - 1].start + last[last.length - 1].text.length;
      out.lastName = field(value, [last[0].start, end], ctx);
    }
  }
  if (first) out.firstName = field(first.text, [first.start, first.start + first.text.length], ctx);
  return out;
}

function wordsFromMatch(m: RegExpExecArray, groups: number[]): Word[] {
  const words: Word[] = [];
  for (const g of groups) {
    const text = m[g];
    if (!text) continue;
    // Locate the group inside the match (indices flag avoided for target compatibility).
    const offset = m[0].lastIndexOf(text);
    words.push({ text, start: (m.index ?? 0) + offset });
  }
  return words;
}

/**
 * Priority: explicit "nazwisko X" / "imię X" > "pan/pani X Y" > first clause made only of
 * capitalized non-stopwords ("Marek Gregorczyk, przyjazd…", "Kowalczyk, 14 listopada…").
 */
export function extractNames(text: string, ctx: ExtractContext): NameFields {
  const explicitLast = lastOf(new RegExp(`${WS}[Nn]azwisko\\s*:?\\s+(${CAP_WORD})`, "gu"), text);
  const explicitFirst = lastOf(new RegExp(`${WS}[Ii]mię\\s*:?\\s+(${CAP_WORD})`, "gu"), text);

  const honorific = lastOf(
    new RegExp(`${WS}(?:[Pp]an(?:i|ią|u)?|[Pp]aństw[ao])\\s+(${CAP_WORD})(?:\\s+(${CAP_WORD}))?`, "gu"),
    text
  );

  let clause: Word[] | undefined;
  for (const m of text.matchAll(/[^,.;:!?—–]+/gu)) {
    const words = [...m[0].matchAll(/\S+/gu)].map((w) => ({ text: w[0], start: (m.index ?? 0) + (w.index ?? 0) }));
    if (words.length < 1 || words.length > 3) continue;
    const isName = words.every(
      (w) => new RegExp(`^${CAP_WORD}$`, "u").test(w.text) && !STOPWORDS.has(w.text.toLowerCase())
    );
    if (isName) {
      clause = words;
      break;
    }
  }

  const fromHonorific = honorific ? toFields(wordsFromMatch(honorific, [1, 2]), ctx) : {};
  const fromClause = clause ? toFields(clause, ctx) : {};
  const fallback = honorific ? fromHonorific : fromClause;

  return {
    lastName: explicitLast ? toFields(wordsFromMatch(explicitLast, [1]), ctx).lastName : fallback.lastName,
    firstName: explicitFirst ? field(explicitFirst[1], spanOf(explicitFirst, 1), ctx) : fallback.firstName,
  };
}

function spanOf(m: RegExpExecArray, group: number): [number, number] {
  const start = (m.index ?? 0) + m[0].lastIndexOf(m[group]);
  return [start, start + m[group].length];
}
