# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Validate API Input with Zod Before Processing

- **Context**: All Astro API routes (`src/pages/api/`)
- **Problem**: Runtime error / incorrect behavior — invalid or unexpected input reaches business logic when not validated at the boundary.
- **Rule**: Always validate all incoming request data with Zod before any business logic in API routes.
- **Applies to**: plan, plan-review
