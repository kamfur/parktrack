// Shared helpers for the Soniox PoC: env, Polish text normalization, WER, entity checks, Soniox client.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export function loadEnv(root) {
  const envPath = path.join(root, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

export const SONIOX_MODEL = "stt-rt-v5";

export function sonioxHost(region) {
  return region === "global" ? "stt-rt.soniox.com" : "stt-rt.eu.soniox.com";
}

/** Domain hints sent to Soniox in the "context" run. */
export const SONIOX_CONTEXT = {
  general: [
    { key: "domain", value: "Rezerwacja parkingu przy lotnisku" },
    { key: "topic", value: "Pracownik parkingu powtarza na głos dane klienta podczas rozmowy telefonicznej" },
    { key: "setting", value: "Parking przy lotnisku Katowice-Pyrzowice (KTW)" },
  ],
  text:
    "Pracownik podaje nazwisko i imię klienta, numer rejestracyjny samochodu literowany po polsku " +
    "(np. es ka cztery er dwa siedem a = SK4R27A), numer telefonu, adres e-mail, datę i godzinę przyjazdu " +
    "oraz powrotu, liczbę osób, typ parkingu (parking odkryty, wiata, garaż) i kierunek lotu.",
  terms: ["Pyrzowice", "KTW", "wiata", "garaż", "parking odkryty", "numer rejestracyjny", "rejestracja", "dopłata"],
};

// --- Polish normalization -------------------------------------------------

const UNITS = {
  zero: 0,
  jeden: 1,
  jedna: 1,
  jedno: 1,
  dwa: 2,
  dwie: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  sześć: 6,
  siedem: 7,
  osiem: 8,
  dziewięć: 9,
};
const TEENS = {
  dziesięć: 10,
  jedenaście: 11,
  dwanaście: 12,
  trzynaście: 13,
  czternaście: 14,
  piętnaście: 15,
  szesnaście: 16,
  siedemnaście: 17,
  osiemnaście: 18,
  dziewiętnaście: 19,
};
const TENS = {
  dwadzieścia: 20,
  trzydzieści: 30,
  czterdzieści: 40,
  pięćdziesiąt: 50,
  sześćdziesiąt: 60,
  siedemdziesiąt: 70,
  osiemdziesiąt: 80,
  dziewięćdziesiąt: 90,
};
const HUNDREDS = {
  sto: 100,
  dwieście: 200,
  trzysta: 300,
  czterysta: 400,
  pięćset: 500,
  sześćset: 600,
  siedemset: 700,
  osiemset: 800,
  dziewięćset: 900,
};

const ORD_UNITS_M = {
  pierwszego: 1,
  drugiego: 2,
  trzeciego: 3,
  czwartego: 4,
  piątego: 5,
  szóstego: 6,
  siódmego: 7,
  ósmego: 8,
  dziewiątego: 9,
};
const ORD_TEENS_M = {
  dziesiątego: 10,
  jedenastego: 11,
  dwunastego: 12,
  trzynastego: 13,
  czternastego: 14,
  piętnastego: 15,
  szesnastego: 16,
  siedemnastego: 17,
  osiemnastego: 18,
  dziewiętnastego: 19,
};
const ORD_TENS_M = { dwudziestego: 20, trzydziestego: 30 };

/** Adds feminine genitive forms ("szóstej", "dwudziestej") used for hours. */
function withFeminine(map) {
  const out = { ...map };
  for (const [k, v] of Object.entries(map)) out[k.replace(/ego$/, "ej")] = v;
  return out;
}
const ORD_UNITS = withFeminine(ORD_UNITS_M);
const ORD_TEENS = withFeminine(ORD_TEENS_M);
const ORD_TENS = withFeminine(ORD_TENS_M);

/** Polish letter names, as spoken when spelling a license plate. */
const LETTER_NAMES = {
  be: "b",
  ce: "c",
  de: "d",
  ef: "f",
  gie: "g",
  ha: "h",
  jot: "j",
  ka: "k",
  el: "l",
  em: "m",
  en: "n",
  pe: "p",
  ku: "q",
  er: "r",
  es: "s",
  te: "t",
  fau: "v",
  wu: "w",
  iks: "x",
  igrek: "y",
  zet: "z",
};

const DROP_WORDS = new Set(["yyy", "eee", "mhm", "aha", "małpa", "kropka"]);

function classify(word) {
  if (word in HUNDREDS) return { kind: "hundreds", value: HUNDREDS[word] };
  if (word in TENS) return { kind: "tens", value: TENS[word] };
  if (word in TEENS) return { kind: "teens", value: TEENS[word] };
  if (word in UNITS) return { kind: "units", value: UNITS[word] };
  if (word in ORD_TENS) return { kind: "ord_tens", value: ORD_TENS[word] };
  if (word in ORD_TEENS) return { kind: "ord_teens", value: ORD_TEENS[word] };
  if (word in ORD_UNITS) return { kind: "ord_units", value: ORD_UNITS[word] };
  return null;
}

/** What may follow each number-word kind inside the same group ("dwadzieścia trzy" = 23, "jeden dwa" = 1, 2). */
const FOLLOWERS = {
  hundreds: ["tens", "teens", "units"],
  tens: ["units"],
  teens: [],
  units: [],
  ord_tens: ["ord_units"],
  ord_teens: [],
  ord_units: [],
};

/**
 * Lowercases, strips punctuation, drops fillers, maps spelled letter names to letters
 * and collapses Polish number words into digits. Returns a word array.
 */
export function normalizeWords(text) {
  const raw = text
    .toLowerCase()
    .replace(/[.,!?;:"„”'()\-@/+]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DROP_WORDS.has(w));

  const out = [];
  let group = null; // { value, kind }
  const flush = () => {
    if (group) out.push(String(group.value));
    group = null;
  };

  for (const word of raw) {
    const num = classify(word);
    if (!num) {
      flush();
      out.push(LETTER_NAMES[word] ?? word);
      continue;
    }
    if (group && FOLLOWERS[group.kind].includes(num.kind)) {
      group = { value: group.value + num.value, kind: num.kind };
    } else {
      flush();
      group = { ...num };
    }
  }
  flush();
  return out;
}

export const compact = (text) => normalizeWords(text).join("");

const stripDiacritics = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");

/** Strict = exact (with diacritics) after normalization; loose = ignoring Polish diacritics. */
export function checkEntity(transcript, value) {
  const hay = compact(transcript);
  const needle = compact(value);
  return {
    strict: hay.includes(needle),
    loose: stripDiacritics(hay).includes(stripDiacritics(needle)),
  };
}

// --- WER ------------------------------------------------------------------

export function wer(reference, hypothesis) {
  const ref = normalizeWords(reference);
  const hyp = normalizeWords(hypothesis);
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return ref.length ? d[ref.length][hyp.length] / ref.length : 0;
}

// --- WAV ------------------------------------------------------------------

/** Minimal RIFF/WAVE parser: returns byte rate and duration, or null if not a PCM WAV. */
export function parseWav(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12;
  let fmt = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      fmt = {
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        byteRate: buf.readUInt32LE(offset + 16),
      };
    } else if (id === "data" && fmt) {
      return { ...fmt, durationSec: size / fmt.byteRate };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

// --- Soniox real-time client ------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Streams one audio file to Soniox real-time over WebSocket.
 * WAV files are paced in real time (100 ms chunks) so latency numbers match a live mic;
 * other formats are sent as fast as possible (no latency stats).
 */
export async function transcribeFile({ filePath, apiKey, host, context, fast = false }) {
  const buf = await readFile(filePath);
  const wav = parseWav(buf);
  const paced = Boolean(wav) && !fast;
  const chunkBytes = paced ? Math.round(wav.byteRate / 10) : 32 * 1024;

  const ws = new WebSocket(`wss://${host}/transcribe-websocket`);
  ws.binaryType = "arraybuffer";

  const finalTokens = [];
  const finalLatencies = [];
  const partialLatencies = [];
  let t0 = 0;
  let sendDoneAt = 0;

  const done = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for Soniox")), 180_000);
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString());
      if (msg.error_code) {
        clearTimeout(timeout);
        reject(new Error(`Soniox ${msg.error_code} ${msg.error_type}: ${msg.error_message}`));
        return;
      }
      const now = performance.now();
      let maxEnd = -1;
      for (const tok of msg.tokens ?? []) {
        if (tok.text === "<end>" || tok.text === "<fin>") continue;
        maxEnd = Math.max(maxEnd, tok.end_ms ?? -1);
        if (tok.is_final) {
          finalTokens.push(tok);
          if (paced && tok.end_ms != null) finalLatencies.push(now - (t0 + tok.end_ms));
        }
      }
      if (paced && maxEnd >= 0) partialLatencies.push(now - (t0 + maxEnd));
      if (msg.finished) {
        clearTimeout(timeout);
        resolve();
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error (check API key and region)"));
    });
    ws.addEventListener("close", (e) => {
      if (e.code !== 1000) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket closed: ${e.code} ${e.reason}`));
      }
    });
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  ws.send(
    JSON.stringify({
      api_key: apiKey,
      model: SONIOX_MODEL,
      audio_format: "auto",
      language_hints: ["pl"],
      enable_endpoint_detection: true,
      client_reference_id: `parktrack-poc-${path.basename(filePath)}`,
      ...(context ? { context } : {}),
    })
  );

  // Soniox may reject mid-stream (e.g. bad key); stop sending and surface that error from `await done`.
  let failed = false;
  done.catch(() => {
    failed = true;
  });

  t0 = performance.now();
  for (let off = 0; off < buf.length && !failed; off += chunkBytes) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(buf.subarray(off, off + chunkBytes));
    if (paced) {
      const target = t0 + ((off + chunkBytes) / wav.byteRate) * 1000;
      const wait = target - performance.now();
      if (wait > 0) await sleep(wait);
    }
  }
  sendDoneAt = performance.now();
  if (ws.readyState === WebSocket.OPEN) ws.send("");

  await done;
  const finishedAt = performance.now();
  ws.close();

  return {
    transcript: finalTokens
      .map((t) => t.text)
      .join("")
      .trim(),
    lowConfidence: finalTokens
      .filter((t) => t.confidence != null && t.confidence < 0.7)
      .map((t) => ({ text: t.text.trim(), confidence: t.confidence })),
    durationSec: wav?.durationSec ?? null,
    paced,
    finalLatencies,
    partialLatencies,
    tailMs: finishedAt - sendDoneAt,
  };
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
