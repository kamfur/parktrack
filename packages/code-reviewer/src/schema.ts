import { z } from "zod";

/**
 * Structured PR review output (M5L2).
 * Scores stay as plain z.number() — Anthropic structured output rejects
 * minimum/maximum on integers; range 1–10 is enforced by prompt + describes.
 */
export const ReviewResult = z.object({
  implementationCorrectness: z
    .number()
    .describe(
      "Poprawność implementacji (1–10). 1: logika błędna lub psuje istniejące zachowania. 10: poprawny na ścieżce głównej, brzegach i błędach."
    ),
  idiomaticity: z
    .number()
    .describe(
      "Idiomatyczność (1–10): zgodność z konwencjami języka i projektu (Astro SSR, React islands, Zod)."
    ),
  complexity: z
    .number()
    .describe(
      "Złożoność (1–10): prostota rozwiązania względem problemu (10 = najprostsze sensowne)."
    ),
  testRiskCoverage: z
    .number()
    .describe(
      "Pokrycie testami proporcjonalne do ryzyka zmienianych ścieżek (1–10)."
    ),
  securitySafety: z
    .number()
    .describe(
      "Bezpieczeństwo (1–10): brak podatności, wycieków sekretów, walidacja wejścia."
    ),
  verdict: z.enum(["pass", "fail"]).describe("Wiążący werdykt dla całej zmiany"),
  summary: z
    .string()
    .describe(
      "Podsumowanie w Markdown, gotowe jako komentarz do PR-a (2–6 zdań + bullet findings)."
    ),
});

export type ReviewResult = z.infer<typeof ReviewResult>;
