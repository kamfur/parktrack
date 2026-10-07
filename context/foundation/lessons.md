# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Validate API Input with Zod Before Processing

- **Context**: All Astro API routes (`src/pages/api/`)
- **Problem**: Runtime error / incorrect behavior — invalid or unexpected input reaches business logic when not validated at the boundary.
- **Rule**: Always validate all incoming request data with Zod before any business logic in API routes.
- **Applies to**: plan, plan-review

## Align Form Types with Zod Schemas

- **Context**: React forms using `react-hook-form` + `zodResolver` (`src/components/**`, `src/lib/schemas/`)
- **Problem**: A hand-written `interface` for form data diverges from the Zod schema (optional vs required fields). TypeScript errors cascade through `useForm`, `FormField`, and submit handlers; the post-edit typecheck hook blocks every `.tsx` edit.
- **Rule**: Derive form ViewModels from `z.infer<typeof schema>` and re-export from `src/types.ts` — never duplicate field optionality in a parallel interface.
- **Applies to**: implement, plan-review
