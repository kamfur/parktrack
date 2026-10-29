// Runs every recording in ./recordings through Soniox real-time and writes a report to ./results.
// Usage: node scripts/soniox-poc/run.mjs [--mode=both|context|plain] [--only=s01-basic,s02-phone-groups] [--fast]
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONIOX_CONTEXT, checkEntity, loadEnv, percentile, sonioxHost, transcribeFile, wer } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.resolve(here, "../.."));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const mode = args.mode ?? "both";
const only = typeof args.only === "string" ? new Set(args.only.split(",")) : null;
const fast = Boolean(args.fast);

const apiKey = process.env.SONIOX_API_KEY;
if (!apiKey) {
  console.error("Missing SONIOX_API_KEY in .env (https://console.soniox.com).");
  process.exit(1);
}
const region = process.env.SONIOX_REGION ?? "eu";
const host = sonioxHost(region);

const scenarios = JSON.parse(await readFile(path.join(here, "scenarios.json"), "utf8"));
const recDir = path.join(here, "recordings");
await mkdir(recDir, { recursive: true });
const files = await readdir(recDir);

const runs = mode === "both" ? ["plain", "context"] : [mode];
const results = [];

for (const sc of scenarios) {
  if (only && !only.has(sc.id)) continue;
  const file = files.find((f) => f.startsWith(`${sc.id}.`));
  if (!file) {
    console.warn(`- ${sc.id}: no recording, skipped`);
    continue;
  }
  for (const run of runs) {
    process.stdout.write(`- ${sc.id} [${run}] ... `);
    try {
      const r = await transcribeFile({
        filePath: path.join(recDir, file),
        apiKey,
        host,
        context: run === "context" ? SONIOX_CONTEXT : null,
        fast,
      });
      const entities = sc.entities.map((e) => ({ ...e, ...checkEntity(r.transcript, e.value) }));
      const row = {
        id: sc.id,
        run,
        file,
        wer: wer(sc.script, r.transcript),
        entities,
        transcript: r.transcript,
        lowConfidence: r.lowConfidence,
        durationSec: r.durationSec,
        paced: r.paced,
        finalP50: percentile(r.finalLatencies, 50),
        finalP95: percentile(r.finalLatencies, 95),
        partialP50: percentile(r.partialLatencies, 50),
        tailMs: r.tailMs,
      };
      results.push(row);
      const hits = entities.filter((e) => e.strict).length;
      console.log(`WER ${(row.wer * 100).toFixed(1)}%, entities ${hits}/${entities.length}`);
    } catch (err) {
      console.log(`ERROR ${err.message}`);
      results.push({ id: sc.id, run, file, error: err.message });
    }
  }
}

if (!results.length) {
  console.error(`\nNo recordings found in ${recDir}. Record them first: node scripts/soniox-poc/record-server.mjs`);
  process.exit(1);
}

// --- Aggregate --------------------------------------------------------------

const fmtPct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
const fmtMs = (x) => (x == null ? "—" : `${Math.round(x)} ms`);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function summarize(run) {
  const rows = results.filter((r) => r.run === run && !r.error);
  const ents = rows.flatMap((r) => r.entities);
  const byLabel = {};
  for (const e of ents) {
    byLabel[e.label] ??= { n: 0, strict: 0, loose: 0 };
    byLabel[e.label].n++;
    if (e.strict) byLabel[e.label].strict++;
    if (e.loose) byLabel[e.label].loose++;
  }
  const paced = rows.filter((r) => r.paced);
  return {
    run,
    recordings: rows.length,
    errors: results.filter((r) => r.run === run && r.error).length,
    meanWer: mean(rows.map((r) => r.wer)),
    entityStrict: ents.length ? ents.filter((e) => e.strict).length / ents.length : null,
    entityLoose: ents.length ? ents.filter((e) => e.loose).length / ents.length : null,
    byLabel,
    finalP50: mean(paced.map((r) => r.finalP50).filter((x) => x != null)),
    finalP95: mean(paced.map((r) => r.finalP95).filter((x) => x != null)),
    partialP50: mean(paced.map((r) => r.partialP50).filter((x) => x != null)),
    audioSec: rows.reduce((a, r) => a + (r.durationSec ?? 0), 0),
  };
}

const summaries = runs.map(summarize);
const labels = [...new Set(summaries.flatMap((s) => Object.keys(s.byLabel)))];

const md = [];
md.push(`# Soniox PoC results — ${new Date().toISOString()}`, "");
md.push(`Model: \`stt-rt-v5\`, host: \`${host}\`, mode: ${mode}${fast ? " (fast, no latency)" : ""}`, "");
md.push("## Summary", "");
md.push(`| Metric | ${runs.join(" | ")} |`, `|---|${runs.map(() => "---").join("|")}|`);
const line = (name, fn) => md.push(`| ${name} | ${summaries.map(fn).join(" | ")} |`);
line("Recordings (errors)", (s) => `${s.recordings} (${s.errors})`);
line("Mean WER", (s) => fmtPct(s.meanWer));
line("Entities strict", (s) => fmtPct(s.entityStrict));
line("Entities loose (no diacritics)", (s) => fmtPct(s.entityLoose));
for (const l of labels) line(`  ${l}`, (s) => (s.byLabel[l] ? `${s.byLabel[l].strict}/${s.byLabel[l].n}` : "—"));
line("Partial latency p50", (s) => fmtMs(s.partialP50));
line("Final latency p50", (s) => fmtMs(s.finalP50));
line("Final latency p95", (s) => fmtMs(s.finalP95));
line("Audio (min) / est. cost", (s) => `${(s.audioSec / 60).toFixed(1)} / $${((s.audioSec / 3600) * 0.12).toFixed(4)}`);
md.push("", "Go/no-go thresholds: see README.md.", "", "## Per recording", "");

for (const sc of scenarios) {
  const rows = results.filter((r) => r.id === sc.id);
  if (!rows.length) continue;
  md.push(`### ${sc.id}`, "", `> ${sc.script}`, "");
  for (const r of rows) {
    if (r.error) {
      md.push(`**${r.run}** — ERROR: ${r.error}`, "");
      continue;
    }
    md.push(`**${r.run}** — WER ${fmtPct(r.wer)}, final p95 ${fmtMs(r.finalP95)}`, "", "```", r.transcript, "```", "");
    const missed = r.entities.filter((e) => !e.strict);
    if (missed.length)
      md.push(
        `Missed: ${missed.map((e) => `${e.label}=\`${e.value}\`${e.loose ? " (diacritics only)" : ""}`).join(", ")}`,
        ""
      );
    if (r.lowConfidence.length)
      md.push(
        `Low confidence (<0.7): ${r.lowConfidence.map((t) => `\`${t.text}\` ${t.confidence.toFixed(2)}`).join(", ")}`,
        ""
      );
  }
}

const outDir = path.join(here, "results");
await mkdir(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
await writeFile(path.join(outDir, `${stamp}.md`), md.join("\n"));
await writeFile(path.join(outDir, `${stamp}.json`), JSON.stringify({ host, mode, summaries, results }, null, 2));

console.log(`\n${md.slice(0, md.indexOf("## Per recording")).join("\n")}`);
console.log(`Report: scripts/soniox-poc/results/${stamp}.md`);
