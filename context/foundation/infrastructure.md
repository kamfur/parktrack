---
project: "ParkTrack — Statistics & Invoicing"
researched_at: "2026-08-25"
recommended_platform: Railway
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 5 SSR (Node adapter, standalone)
  runtime: Node.js (port 3000, persistent process)
  database: Supabase (external — Postgres + Auth + RLS)
---

## Recommendation

**Deploy on Railway.**

Railway is the lowest-friction path for an Astro 5 SSR app with the Node adapter in standalone mode: it auto-detects Node.js, runs `npm run build` then `npm start` without a Dockerfile, and its official Astro SSR guide documents the exact `HOST=0.0.0.0` + standalone entry point pattern. At $5/month (Hobby plan, credit included), it is the cheapest option that runs a persistent Node.js process — a hard requirement that eliminates Cloudflare, Vercel, and Netlify entirely. For a solo developer with no prior platform familiarity deploying a 1–10 user parking management app, Railway offers the fastest path from git push to running server.

## Platform Comparison

Three platforms were eliminated by the hard filter (persistent Node.js process required):

| Platform | Persistent process? | Verdict |
|---|---|---|
| Cloudflare Workers/Pages | No — V8 isolates, request-scoped | **Dropped** |
| Vercel | No — serverless functions only | **Dropped** |
| Netlify | No — serverless/edge functions only | **Dropped** |

Scored platforms (all three support persistent Node.js containers):

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/Integration | Pass count |
|---|---|---|---|---|---|---|
| **Railway** | Partial | Pass | Pass | Pass | Partial | 3 Pass / 2 Partial |
| **Render** | Partial | Pass | Pass | Pass | Partial | 3 Pass / 2 Partial |
| **Fly.io** | Pass | Pass | Partial | Pass | Partial | 3 Pass / 2 Partial |

**Scoring notes:**

- **CLI-first — Railway Partial**: Deploy (`railway up`) and log tailing (`railway logs`) are CLI. Rollback is dashboard-only — no `railway rollback` command exists. This is a real agent gap.
- **CLI-first — Render Partial**: Deploy (`render deploys create`) and logs (`render logs --tail`) are CLI. Rollback requires the dashboard or a REST API call (`POST /v1/services/{id}/deploys/{deployId}/rollback`) — scriptable but not a CLI command.
- **CLI-first — Fly.io Pass**: Rollback is two-step (`fly releases` to find the prior image tag, then `fly deploy --image <tag>`) but is fully CLI. No dashboard required.
- **Agent docs — Railway/Render Pass**: Both publish `llms.txt` (railway.com/llms.txt, render.com/docs/llms.txt) and full markdown doc sources. Railway also exposes a machine-readable docs API.
- **Agent docs — Fly.io Partial**: Docs are on GitHub (superfly/docs) as markdown and fetchable, but no `llms.txt` index file was found.
- **MCP — Railway Partial**: Remote MCP at `mcp.railway.com` launched April 2026, currently in public testing. Official Claude Code integration page at railway.com/agents/claude.
- **MCP — Render Partial**: Official MCP server (`render-oss/render-mcp-server`, 135+ commits, coding agent plugins for Claude Code) released but without an explicit GA announcement. Docs MCP in experimental/preview.
- **MCP — Fly.io Partial**: `fly mcp server --claude` installs first-class Claude integration, but documentation describes it as "under active development" with some commands not yet fully supported.

**Soft weight applied (interview answers):**

- Cost ≈ DX (equal weight): Railway ($5/mo) ≤ Fly.io ($5–7/mo, with `min_machines_running=1`) < Render ($7/mo Starter)
- No familiarity → no tie-break by platform preference
- Single region → edge-native advantage not applied
- External providers fine → Supabase stays; co-location not a differentiator

### Shortlisted Platforms

#### 1. Railway (Recommended)

Railway wins on the combination of lowest cost ($5/month Hobby plan, no Dockerfile required) and best Astro SSR documentation (official guide documents the exact `HOST=0.0.0.0` and `node ./dist/server/entry.mjs` pattern). Its `llms.txt` and machine-readable docs give agents strong self-service access to platform documentation. The MCP server (public testing) and `railway up` CLI cover most day-to-day agent operations. The dashboard-only rollback is the main gap — manageable for MVP where deliberate deploys are standard practice and a 1-minute browser rollback is acceptable.

#### 2. Render

Render is the strongest alternative: it has an official Astro SSR template with `render.yaml` pre-configured, `llms.txt` docs, and a REST API rollback path that agents can call (`POST /v1/services/{id}/deploys/{deployId}/rollback`) — more scriptable than Railway's dashboard-only path. Its MCP server has more commits and appears closer to GA. The $7/month Starter is the practical minimum (free tier cold-starts after 15 minutes idle, making it unsuitable for SSR). Render is the right swap if Railway's dashboard-only rollback proves too limiting.

#### 3. Fly.io

Fly.io is the most operationally complete: full CLI rollback (via `fly releases` + `fly deploy --image`), genuine VM-level isolation, and a first-class `fly mcp server --claude` integration. `fly launch` auto-generates a Dockerfile for the Astro Node adapter. The cost is competitive ($2–7/month, with autostop disabled). The main gaps vs the top two: no `llms.txt`, a Dockerfile that must be committed and maintained, and the autostop-by-default behavior that requires explicit configuration (`min_machines_running = 1`) to avoid cold starts for always-on use. Fly.io is the right choice if CLI-driven rollback becomes a priority or the app is later containerized for other reasons.

## Anti-Bias Cross-Check: Railway

### Devil's Advocate — Weaknesses

1. **No CLI rollback blocks unattended agent recovery.** When a bad deploy causes 500s, the agent cannot roll back from the terminal. Every rollback requires browser access to the Railway dashboard — exactly the kind of human-gating that makes automated incident response impossible.
2. **Hobby credit exhausts silently.** The $5/month Hobby plan includes $5 of resource credit with no configurable warning. A minimal container costs ~$2.80–3.50/month running continuously — that's fine, but a build step spike or second service can drain the headroom and suspend the app during business hours with no alert.
3. **MCP in public testing means an unstable API surface.** Railway's `mcp.railway.com` launched April 2026. The schema, auth model, and tool definitions can change without a deprecation notice. Agent workflows built around it are on fragile ground until it reaches GA.
4. **`0.0.0.0` binding is a silent failure mode.** If `server: { host: '0.0.0.0' }` is absent from `astro.config.mjs`, the Astro server binds to `127.0.0.1`, Railway's health check fails, and the deploy "succeeds" while every request returns 502. Documented in Railway's guide but trivially easy to miss.
5. **Community reliability reports flag deployment queue delays.** 2026 reports cite Railway deployment queues backing up during platform incidents, with stale dashboard state causing rollback buttons to grey out precisely when they're needed most.

### Pre-mortem — How This Could Fail

The team shipped ParkTrack to Railway Hobby in week one and everything ran smoothly for three weeks. Then mid-sprint a broken middleware went out, causing 500s on all authenticated routes — parking lot staff couldn't log in. The fix was ready in 20 minutes, but the Railway dashboard showed a stale deploy state (a known community issue), and the rollback button was greyed out. Hobby support is community-only with no SLA; the deployment queue cleared an hour later.

Two months in, resource usage crept up as the statistics dashboard shipped — more database queries, longer SSR render times per request. The $5 Hobby credit ran out on the 25th of the month. Railway suspended the service without a warning email. Staff arrived Monday morning to an unresponsive app. Upgrading to Pro ($20/month) tripled the monthly cost and revealed that the Hobby plan's credit ceiling was never designed for always-on SSR workloads that occasionally spike.

By month three, the MCP schema changed once without announcement — breaking the agent's tool calls until the Railway skill was manually updated. The CLI-first promise held for deployments, but every operational incident revealed the same gap: no rollback without a browser, no credit alert without manual monitoring.

### Unknown Unknowns

- **Credit exhaustion has no configurable alert.** The $5 Hobby credit refills monthly, but Railway sends no email as it depletes. A spike in traffic or a runaway build drains it silently and suspends the service.
- **Environment variable changes trigger a full redeploy.** Rotating a Supabase service-role key restarts the container and causes a brief downtime window — not obvious from the UI.
- **`railway redeploy` redeploys the latest commit, not the current running image.** If the latest commit has a broken build, `railway redeploy` fails again. There is no CLI shortcut to "re-run this exact previous successful deployment" — that path goes through the dashboard.
- **The `PORT` env var is injected dynamically.** If any start script hardcodes port 3000, it may conflict with Railway's injected value. Rely on the env var; the official Astro guide documents this correctly.

## Operational Story

- **Preview deploys**: Railway supports PR Environments (a temporary service deployed per PR, auto-torn-down on PR close) when the GitHub repo is connected and the feature is enabled in the Railway project settings. Each PR gets its own `.up.railway.app` URL. No built-in auth protection on preview URLs — restrict access at the network level if needed. Disabled by default; enable per-service in the Railway dashboard.
- **Secrets**: Environment variables live in Railway's encrypted variable store per service+environment. Set via `railway variables set KEY=value` CLI or the dashboard Variables panel. Injected at container start — changing a variable triggers a redeploy (brief downtime). Rotation: update via CLI or dashboard, confirm redeploy. Secrets are not exposed in build logs.
- **Rollback**: Dashboard only — Service → Deployments → three-dot menu on a prior deployment → "Rollback". Takes effect in ~30–60 seconds (re-deploys the prior container image). Typical time-to-revert: under 2 minutes. **Caveat: Supabase DB migrations do not auto-revert.** Rolling back the app code after a migration has run leaves the schema in the migrated state — plan manual schema rollback separately.
- **Approval**: Deployments trigger automatically on `railway up` or git push (when GitHub connected). Destructive actions (deleting a Railway service, dropping a Railway database if one is added, rotating account-level API tokens) must be performed in the Railway dashboard — no CLI command for service deletion in production. An agent may deploy, tail logs, and set variables unattended; destroying services requires a human in the dashboard.
- **Logs**: `railway logs` — streams stdout/stderr via WebSocket. Flags: `--build` (build phase only), `--http` (HTTP access logs), `--network`, `--lines N`. Log rate limit: 500 lines/second per replica. Historical logs also available in the dashboard "Logs" tab. Read-only via CLI; no write or delete operations on logs.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| No CLI rollback — agent blocked on bad deploy | Devil's advocate | H | M | Keep Railway dashboard bookmarked; add `railway deploy --detach` flag to CI so build output is captured; consider Render as rollback-capable alternative if this proves limiting |
| Hobby credit exhausts silently, suspending service | Devil's advocate / Pre-mortem | M | H | Set a Railway spend alert via the billing dashboard; monitor monthly resource usage; budget for Pro ($20/mo) if usage grows past $5 consistently |
| `0.0.0.0` binding absent causes 502 on all requests | Devil's advocate / Research finding | M | H | Verify `server: { host: '0.0.0.0' }` in `astro.config.mjs` before first deploy; Railway health check will surface this immediately if misconfigured |
| MCP schema change breaks agent tooling | Unknown unknowns | M | L | Pin MCP usage to CLI (`railway up`, `railway logs`) for critical operations; treat MCP as a convenience layer only until it reaches GA |
| `railway redeploy` fails if latest commit is broken | Unknown unknowns | M | M | Tag working deploys in git; document the dashboard rollback path in the project runbook |
| Deployment queue delays during Railway incidents | Research finding | L | M | Monitor Railway status page (status.railway.com); keep `fly.io` or `render.com` as a documented fallback deployment path |
| DB migration not rolled back with app rollback | Research finding | M | H | Write rollback SQL alongside every migration; test rollback SQL in staging before shipping to production |

## Getting Started

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and create project**
   ```bash
   railway login
   railway init
   ```

3. **Verify `astro.config.mjs`** — the Node adapter must bind to all interfaces:
   ```js
   import { defineConfig } from 'astro/config';
   import node from '@astrojs/node';

   export default defineConfig({
     output: 'server',
     adapter: node({ mode: 'standalone' }),
     server: { host: '0.0.0.0' }
   });
   ```

4. **Verify `package.json` start script** — Railway runs `npm start` after build:
   ```json
   "scripts": {
     "build": "astro build",
     "start": "node ./dist/server/entry.mjs"
   }
   ```

5. **Set Supabase environment variables**
   ```bash
   railway variables set PUBLIC_SUPABASE_URL=<your-supabase-project-url>
   railway variables set PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   railway variables set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
   Do not hardcode these values — Railway injects them at container start.

6. **Deploy**
   ```bash
   railway up
   ```
   Railway auto-detects Node.js, runs `npm run build`, then starts with `npm start`. The `PORT` env var is injected automatically; no hardcoded port 3000 in the start command.

7. **Tail runtime logs**
   ```bash
   railway logs
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions)
- Production-scale architecture (multi-region, HA, DR)
