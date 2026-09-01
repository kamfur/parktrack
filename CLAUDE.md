## ParkTrack — Project Conventions

### Directory layout
- `src/pages/` — Astro pages (file-based routing)
- `src/pages/api/` — API endpoints (server-only)
- `src/layouts/` — Astro layout components
- `src/components/` — Astro (static) and React (interactive) components
- `src/components/ui/` — Shadcn/ui components (do not hand-edit)
- `src/lib/` — services and helpers; extract business logic to `src/lib/services/`
- `src/db/` — Supabase clients and generated database types
- `src/types.ts` — shared types (Entities, DTOs) for backend and frontend
- `src/middleware/index.ts` — Astro middleware (single file)

### Astro API routes
- Always add `export const prerender = false` to API route files.
- Export handlers as named exports: `export const GET`, `export const POST` (uppercase).
- Validate all incoming data with Zod before processing.
- Extract business logic into `src/lib/services/`; keep handlers thin.

### Supabase client
- Import the Supabase client from `context.locals` in Astro routes: `const supabase = context.locals.supabase`
- Never import `supabaseClient` directly in Astro pages.
- Use `SupabaseClient` type from `src/db/supabase.client.ts`, not from `@supabase/supabase-js`.

### React components
- Use React only for interactive UI; prefer Astro components for static content.
- Do NOT use "use client" or any Next.js directives — this is Astro, not Next.js.
- Extract reusable logic into custom hooks in `src/hooks/`.

### Testing (current state: no test runner configured)
- Until Vitest is added, rely on TypeScript strict mode and Zod validation as the primary correctness signal.
- Run `npm run lint` and `npm run build` before marking any task complete.
- Verify behavior manually via `npm run dev` (port 3000).

### CI/CD (current state: no pipeline configured)
- Run `npm run lint` and `npm run build` locally; treat any error as a blocker.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
