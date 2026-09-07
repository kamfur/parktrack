# CI/CD Code Review — requirements (M5L3 / 10xChampion)

## Overall concept

- GHA workflow on every pull request to `main` (+ `workflow_dispatch`, + label `ai-cr:review`)
- Local composite action (`.github/actions/ai-code-review`) wrapping `@parktrack/code-reviewer`
- Soft score → hard DoD: job fails on `verdict: fail` (merge gate when required)

## Input parameters

- pull request title
- pull request description
- git diff (base...HEAD)

## Code Review Criteria (1–10)

1. **implementationCorrectness** — kod robi to, co deklaruje
2. **idiomaticity** — Astro SSR / React islands / Zod / ParkTrack AGENTS.md
3. **complexity** — prostota względem problemu
4. **testRiskCoverage** — testy proporcjonalne do ryzyka
5. **securitySafety** — walidacja wejścia, brak wycieków sekretów / service role w złym miejscu

## Parked for later

- business alignment
- architectural fit vs full `context/` map
- promptfoo multi-model matrix (optional M5L3 task 3)

## Expected side-effects

- PR comment with Markdown summary (+ scores table)
- labels: `ai-cr:failed` OR `ai-cr:passed`
- on-demand retry when label `ai-cr:review` is added

## Secrets

- `OPENROUTER_API_KEY` (repo Actions secret)
