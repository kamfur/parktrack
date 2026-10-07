import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSampleDiff(sample: string): string {
  const path = join(__dirname, "..", "data", `${sample}.md`);
  let diff = readFileSync(path, "utf8").trim();
  if (diff.startsWith("```")) {
    diff = diff.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
  }
  return diff + "\n";
}

/** Prefer stdin pipe; otherwise load data/<sample>.md (default sample-1). */
export async function readDiff(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const piped = Buffer.concat(chunks).toString("utf8").trim();
    if (piped) return piped + "\n";
  }
  const sample = process.argv[2] ?? "sample-1";
  return loadSampleDiff(sample);
}
