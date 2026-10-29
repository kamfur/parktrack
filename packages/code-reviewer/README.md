# @parktrack/code-reviewer (M5L2)

Lokalny agent code review: **Vercel AI SDK** (`ToolLoopAgent`) + **OpenRouter**.

## Setup

```bash
cd packages/code-reviewer
cp .env.example .env
# wklej OPENROUTER_API_KEY=
npm install
```

Albo dodaj `OPENROUTER_API_KEY` do rootowego `parktrack/.env`.

## Uruchomienie

```bash
npm run review -- sample-1          # symulowany diff ParkTrack (celowo zły)
git diff | npm run review           # review working tree
git diff main...HEAD | npm run review
```

Oczekiwany wynik: JSON ze score’ami 1–10, `verdict` pass/fail i `summary` Markdown.

## CI (M5L3)

Composite action: `../../.github/actions/ai-code-review`  
Workflow: `../../.github/workflows/ai-review.yml`  

Wymaga secretu repo `OPENROUTER_API_KEY`. Zobacz `../../context/changes/ci-cd-code-review/champion-howto.md`.
