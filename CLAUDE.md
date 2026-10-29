## ParkTrack — Agent index

**Not an encyclopedia.** Hard rules and commands: `@AGENTS.md`. Depth: `@context/README.md`.

| Need | Read |
|---|---|
| What we're building | `@context/foundation/prd.md` (M-1), `@context/foundation/prd-v2.md` (Driver Ops) |
| What to build next | `@context/foundation/roadmap.md` |
| How to test | `@context/foundation/test-plan.md` |
| API route work | `@src/pages/api/AGENTS.md` |
| Lessons from past bugs | `@context/foundation/lessons.md` |
| When to split more context | `@context/maturity.md` |

### Conventions (summary)

- Layout: `src/pages/`, `src/pages/api/`, `src/lib/services/`, `src/components/`, `src/hooks/`
- API: Zod at boundary, thin handlers, logic in services
- Supabase: `context.locals.supabase` in Astro routes
- React only for interactivity; Shadcn in `src/components/ui/` — do not hand-edit

Full command list and CI gate: `@AGENTS.md`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 4, Lesson 1 (Context Architecture)

- **Root = index, `context/` = truth.** Keep `AGENTS.md` / this file under ~150 lines; link with `@path`, never paste PRD or test-plan bodies here.
- **Loading is additive** — org rules + root + nested `AGENTS.md` merge; closest nested file narrows scope for that path.
- **Maturity ladder:** `@context/maturity.md` — add nested guides only when triggers fire (size, repeated mistakes, distinct conventions).

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
