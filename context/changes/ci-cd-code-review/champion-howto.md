# Champion path: AI Code Review CI (M5L3)

## Co jest w repo

| Plik | Rola |
|------|------|
| `packages/code-reviewer/` | Agent M5L2 (Vercel AI SDK + OpenRouter) |
| `.github/actions/ai-code-review/` | Composite action: review → komentarz → labelki → gate |
| `.github/workflows/ai-review.yml` | Trigger na PR do `main` (+ label `ai-cr:review`) |
| `context/changes/ci-cd-code-review/requirements.md` | Wymagania MVP |

## Setup (jednorazowo)

1. Upewnij się, że remote GitHub istnieje i masz push (`gh repo view` / Settings).
2. Dodaj secret w repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `OPENROUTER_API_KEY`
   - Value: ten sam klucz co lokalnie
3. Commit + push branch z tymi plikami, otwórz PR do `main`.

## Dowody 10xChampion (zrzuty)

1. **Pipeline** — Actions → run `ai-code-review` z widocznym jobem `AI Code Review`
2. **Logi** — rozwinięty step `Run AI review` / `Comment on PR`
3. **Komentarz LLM** — komentarz na PR zaczynający się od `AI Code Review`

## Retry

Dodaj label `ai-cr:review` na PR — workflow odpali się ponownie.
