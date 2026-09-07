import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { REVIEWER_PROMPT } from "./prompt.js";
import { ReviewResult } from "./schema.js";
import { buildReviewUserPrompt, type ReviewContext } from "./format.js";

// Cheaper default — course uses z-ai/glm-5.1; override via OPENROUTER_MODEL.
// GLM defaults to huge max_tokens and needs more OpenRouter credits.
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = Number(process.env.REVIEW_MAX_OUTPUT_TOKENS ?? 2048);

export function createReviewer(modelId: string = DEFAULT_MODEL) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Brak OPENROUTER_API_KEY. Dodaj klucz do packages/code-reviewer/.env lub parktrack/.env (patrz .env.example)."
    );
  }

  const openrouter = createOpenRouter({ apiKey });

  return new ToolLoopAgent({
    model: openrouter(modelId),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: ReviewResult }),
    stopWhen: stepCountIs(2),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
}

export async function reviewDiff(
  diffOrCtx: string | ReviewContext
): Promise<ReviewResult> {
  const ctx: ReviewContext =
    typeof diffOrCtx === "string" ? { diff: diffOrCtx } : diffOrCtx;

  const reviewer = createReviewer();
  const { output } = await reviewer.generate({
    prompt: buildReviewUserPrompt(ctx),
  });
  if (!output) {
    throw new Error("Agent nie zwrócił structured output");
  }
  return output;
}
