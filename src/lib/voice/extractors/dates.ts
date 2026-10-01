import { addUtcDays } from "@/lib/calendar/warsaw-time";
import { WE, WS, field, type ExtractContext, type VoiceDateTime, type VoiceField } from "../types";

export interface DateFields {
  checkIn?: VoiceField<VoiceDateTime>;
  checkOut?: VoiceField<VoiceDateTime>;
}

type Role = "in" | "out";

interface DateMatch {
  start: number;
  end: number;
  date: string | null; // null = invalid calendar date, dropped later
  explicitRole?: Role;
}

const MONTHS: Record<string, number> = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  września: 9,
  października: 10,
  listopada: 11,
  grudnia: 12,
};
const MONTH = Object.keys(MONTHS).join("|");

const WEEKDAYS: Record<string, number> = {
  poniedziałek: 1,
  wtorek: 2,
  środę: 3,
  czwartek: 4,
  piątek: 5,
  sobotę: 6,
  niedzielę: 0,
};

const RANGE = new RegExp(`${WS}od\\s+(\\d{1,2})\\s+do\\s+(\\d{1,2})\\s+(${MONTH})${WE}`, "giu");
const DAY_MONTH = new RegExp(`${WS}(\\d{1,2})\\s+(${MONTH})${WE}`, "giu");
const NUMERIC = new RegExp(`${WS}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}))?${WE}`, "gu");
const RELATIVE = new RegExp(`${WS}(dziś|dzisiaj|jutro|pojutrze)${WE}`, "giu");
const WEEKDAY = new RegExp(`${WS}w\\s+(${Object.keys(WEEKDAYS).join("|")})${WE}(?!\\s*\\d)`, "giu");

const IN_WORDS = new RegExp(
  `${WS}(?:przyjazd|przyjeżdża\\p{L}*|przyjedzie|wylot|wylatuj\\p{L}*|zostawia\\p{L}*)${WE}`,
  "giu"
);
const OUT_WORDS = new RegExp(
  `${WS}(?:powrót|powrot|wraca\\p{L}*|przylot|przylatuj\\p{L}*|odbiór|odbiera\\p{L}*|odbierze)${WE}`,
  "giu"
);
const CORRECTION = new RegExp(`${WS}(?:nie|przepraszam|poprawiam|poprawka|jednak)${WE}`, "iu");

const TIME = new RegExp(
  `${WS}(?:(?:o|około|godzina|godz\\.?|na)\\s+)?(\\d{1,2}):(\\d{2})(?!\\d)|${WS}(?:o|około|godzina|godz\\.?)\\s+(\\d{1,2})(?![\\d:])(?!\\s*(?:osob|os\\.|dni|${MONTH}))`,
  "iu"
);
const TIME_MODIFIER = /^\s*(rano|wieczorem|w nocy|po południu)/iu;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Valid calendar date at or after today; next year when the day/month already passed. */
function resolveDayMonth(day: number, month: number, today: string, year?: number): string | null {
  const [ty, tm, td] = today.split("-").map(Number);
  const y = year ?? (month < tm || (month === tm && day < td) ? ty + 1 : ty);
  const probe = new Date(Date.UTC(y, month - 1, day));
  if (month < 1 || month > 12 || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

function collectDates(text: string, today: string): DateMatch[] {
  const found: DateMatch[] = [];
  for (const m of text.matchAll(RANGE)) {
    const month = MONTHS[m[3].toLowerCase()];
    const start = m.index ?? 0;
    const secondAt = start + m[0].search(/\sdo\s/iu) + 1;
    found.push({ start, end: secondAt, date: resolveDayMonth(Number(m[1]), month, today), explicitRole: "in" });
    found.push({
      start: secondAt,
      end: start + m[0].length,
      date: resolveDayMonth(Number(m[2]), month, today),
      explicitRole: "out",
    });
  }
  const add = (start: number, end: number, date: string | null) => {
    if (found.some((f) => start < f.end && end > f.start)) return;
    found.push({ start, end, date });
  };
  for (const m of text.matchAll(DAY_MONTH)) {
    const start = m.index ?? 0;
    add(start, start + m[0].length, resolveDayMonth(Number(m[1]), MONTHS[m[2].toLowerCase()], today));
  }
  for (const m of text.matchAll(NUMERIC)) {
    const start = m.index ?? 0;
    const year = m[3] ? Number(m[3]) : undefined;
    add(start, start + m[0].length, resolveDayMonth(Number(m[1]), Number(m[2]), today, year));
  }
  for (const m of text.matchAll(RELATIVE)) {
    const offset = { dziś: 0, dzisiaj: 0, jutro: 1, pojutrze: 2 }[m[1].toLowerCase()] ?? 0;
    const start = m.index ?? 0;
    add(start, start + m[0].length, addUtcDays(today, offset));
  }
  for (const m of text.matchAll(WEEKDAY)) {
    const start = m.index ?? 0;
    // "za tydzień w środę" is out of scope — do not guess.
    if (/za\s+(?:tydzień|\p{L}+\s+tygodni\p{L}*)\s*$/iu.test(text.slice(Math.max(0, start - 25), start))) continue;
    const target = WEEKDAYS[m[1].toLowerCase()];
    const delta = (target - dayOfWeek(today) + 7) % 7 || 7;
    add(start, start + m[0].length, addUtcDays(today, delta));
  }
  return found.sort((a, b) => a.start - b.start);
}

function lastIndex(re: RegExp, text: string): number {
  let idx = -1;
  for (const m of text.matchAll(re)) idx = m.index ?? idx;
  return idx;
}

function roleFromWindow(window: string): Role | "correction" | undefined {
  const prevWord = /(\p{L}+)[^\p{L}]*$/u.exec(window)?.[1]?.toLowerCase();
  if (prevWord === "od") return "in";
  if (prevWord === "do") return "out";
  const inAt = lastIndex(IN_WORDS, window);
  const outAt = lastIndex(OUT_WORDS, window);
  if (inAt >= 0 || outAt >= 0) return inAt > outAt ? "in" : "out";
  if (CORRECTION.test(window)) return "correction";
  return undefined;
}

function timeIn(window: string): { time: string; end: number } | undefined {
  const m = TIME.exec(window);
  if (!m) return undefined;
  let hour = Number(m[1] ?? m[3]);
  const minute = m[2] ? Number(m[2]) : 0;
  const end = (m.index ?? 0) + m[0].length;
  const modifier = TIME_MODIFIER.exec(window.slice(end))?.[1]?.toLowerCase();
  if ((modifier === "wieczorem" || modifier === "po południu") && hour < 12) hour += 12;
  if (modifier === "w nocy" && hour >= 6 && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return undefined;
  return { time: `${pad(hour)}:${pad(minute)}`, end };
}

/**
 * Dates get a role from the words before them (since the previous date): "od"/"do" right before,
 * else the nearest przyjazd/wylot vs powrót/przylot keyword, else a correction marker keeps the
 * previous date's role, else the next unfilled role. The time is the first time expression after
 * the date (before the next date). Last date per role wins.
 */
export function extractDates(text: string, ctx: ExtractContext): DateFields {
  const dates = collectDates(text, ctx.today);
  const out: DateFields = {};
  let prevEnd = 0;
  let prevRole: Role | undefined;

  dates.forEach((d, i) => {
    const window = text.slice(prevEnd, d.start);
    const hint = d.explicitRole ?? roleFromWindow(window);
    const role: Role =
      hint === "in" || hint === "out"
        ? hint
        : hint === "correction" && prevRole
          ? prevRole
          : out.checkIn
            ? "out"
            : "in";
    prevRole = role;
    prevEnd = d.end;
    if (!d.date) return;

    const nextStart = dates[i + 1]?.start ?? text.length;
    const t = timeIn(text.slice(d.end, nextStart));
    const span: [number, number] = [d.start, t ? d.end + t.end : d.end];
    const value = field<VoiceDateTime>({ date: d.date, time: t?.time ?? null }, span, ctx);
    if (role === "in") out.checkIn = value;
    else out.checkOut = value;
  });

  // "od 20 grudnia do 3 stycznia" already rolls over; this covers e.g. today=10.01, "od 5 do 12 stycznia".
  if (out.checkIn && out.checkOut && out.checkOut.value.date < out.checkIn.value.date) {
    const [y, m, d] = out.checkOut.value.date.split("-");
    const bumped = `${Number(y) + 1}-${m}-${d}`;
    if (bumped >= out.checkIn.value.date)
      out.checkOut = { ...out.checkOut, value: { ...out.checkOut.value, date: bumped } };
  }
  return out;
}
