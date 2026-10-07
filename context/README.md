# Context — system of record

Agent instructions at the repo root (`AGENTS.md`, `CLAUDE.md`) are **indexes**. Depth lives here.

## How tools load context (additive, not override)

| Layer | File | Role |
|---|---|---|
| Root | `AGENTS.md` | Hard rules, commands, `@` pointers — read first |
| Root | `CLAUDE.md` | Same index + 10x lesson blocks — not a second encyclopedia |
| Foundation | `context/foundation/` | Product, stack, roadmap, test plan — cross-change truth |
| Changes | `context/changes/` | In-flight work (`/10x-new` → `/10x-archive`) |
| Archive | `context/archive/` | Completed changes — read-only history |
| Nested | `src/**/AGENTS.md` | Area-specific rules when maturity triggers fire |

**Rule:** edit foundation docs in place; archive only when fully superseded (`foundation/archive/`).

## Foundation index

| Doc | Use when |
|---|---|
| `@context/foundation/prd.md` | M-1 scope, user stories, constraints |
| `@context/foundation/prd-v2.md` | Driver Ops (next milestone) |
| `@context/foundation/roadmap.md` | Slice order, milestone status |
| `@context/foundation/tech-stack.md` | Stack facts, deploy target |
| `@context/foundation/test-plan.md` | Risks, test phases, what not to E2E |
| `@context/foundation/infrastructure.md` | Railway, env, ops |
| `@context/foundation/lessons.md` | Recurring rules — re-read before plan/implement |
| `@context/maturity.md` | When to split nested context |

## Changes workflow

Active: `context/changes/<change-id>/` — plan, research, reviews.  
Done: `/10x-archive` → `context/archive/`.
