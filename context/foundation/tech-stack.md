---
starter_id: 10x-astro-starter
package_manager: npm
project_name: parktrack
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: pr-checks
  bootstrapper_confidence: high
  path_taken: brownfield
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

ParkTrack is a brownfield Astro 5 SSR app (Node adapter, standalone) with React 19 islands, TypeScript strict, Supabase (Postgres + Auth + RLS), Tailwind 4, and Shadcn/ui. Runtime is Node on port 3000; database and auth stay on Supabase cloud. The PRD originally named Docker on DigitalOcean; m1l5 re-evaluates the hosting platform deliberately rather than locking that choice in.
