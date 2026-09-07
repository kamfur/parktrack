import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { reviewDiff } from "./agent.js";
import { readDiff } from "./read-diff.js";
import { formatReviewMarkdown } from "./format.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "../../.env") });

const diff = await readDiff();
if (!diff.trim()) {
  console.error(
    "Pusty diff. Użyj: npm run review -- sample-1   lub   git diff | npm run review"
  );
  process.exit(1);
}

const result = await reviewDiff({
  title: process.env.PR_TITLE,
  body: process.env.PR_BODY,
  diff,
});

const jsonOut = process.env.REVIEW_JSON_OUT;
const mdOut = process.env.REVIEW_MD_OUT;
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 2), "utf8");
if (mdOut) writeFileSync(mdOut, formatReviewMarkdown(result), "utf8");

console.log(JSON.stringify(result, null, 2));

if (process.env.REVIEW_FAIL_ON_FAIL === "1" && result.verdict === "fail") {
  process.exit(2);
}
