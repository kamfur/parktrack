import type { ReviewResult } from "./schema.js";

export type ReviewContext = {
  title?: string;
  body?: string;
  diff: string;
};

export function buildReviewUserPrompt(ctx: ReviewContext): string {
  const parts: string[] = [];
  if (ctx.title?.trim()) {
    parts.push(`## PR title\n${ctx.title.trim()}`);
  }
  if (ctx.body?.trim()) {
    parts.push(`## PR description\n${ctx.body.trim()}`);
  }
  parts.push(`## Diff\n\`\`\`diff\n${ctx.diff.trim()}\n\`\`\``);
  return `Zrecenzuj ten pull request.\n\n${parts.join("\n\n")}`;
}

export function formatReviewMarkdown(result: ReviewResult): string {
  const rows = [
    ["Poprawność implementacji", result.implementationCorrectness],
    ["Idiomatyczność", result.idiomaticity],
    ["Złożoność", result.complexity],
    ["Testy vs ryzyko", result.testRiskCoverage],
    ["Bezpieczeństwo", result.securitySafety],
  ] as const;

  const table = [
    "| Kryterium | Score |",
    "|---|---|",
    ...rows.map(([name, score]) => `| ${name} | ${score}/10 |`),
  ].join("\n");

  const badge = result.verdict === "pass" ? "✅ **pass**" : "❌ **fail**";

  return [
    "<!-- parktrack-ai-code-review -->",
    `## AI Code Review — ${badge}`,
    "",
    table,
    "",
    result.summary,
    "",
    "_Agent: `@parktrack/code-reviewer` (M5L2/M5L3) · nie zastępuje ludzkiego approve._",
  ].join("\n");
}
