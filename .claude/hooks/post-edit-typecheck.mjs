import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const TYPECHECKABLE = new Set([".ts", ".tsx"]);

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || !TYPECHECKABLE.has(path.extname(filePath))) {
  process.exit(0);
}

const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status === 0 ? 0 : 2);
