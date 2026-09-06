# DevPulse 2.0

## Project Objective

Transform DevPulse from a passive API health-monitoring SaaS into an **AI-powered incident investigation and debugging platform**. DevPulse should not just tell you *that* something is down — it should tell you *what happened, what changed, why it broke, and how to fix it* — then verify the fix worked after you deploy.

The final flow:

```text
Monitor
   ↓
Detect Incident
   ↓
Understand What Happened
   ↓
Identify What Changed
   ↓
Investigate Root Cause
   ↓
Suggest Fix
   ↓
Developer Deploys Fix
   ↓
Verify Whether Fix Worked
```

---

## Existing DevPulse 1.0

DevPulse 1.0 is a **production-grade API health monitoring SaaS** (monorepo: `backend/` Node.js + `frontend/` React + `landing/`). It monitors HTTP endpoints at configurable intervals, detects UP/DOWN transitions (3 consecutive failures), opens/resolves incidents, and alerts via email, PagerDuty, and webhooks (Slack/Discord/Generic signed). It exposes real-time dashboards over Socket.io, public status pages, per-plan limits (FREE/PRO/BUSINESS), teams, admin console, audit log, API keys, TOTP, OAuth (Google/GitHub), and an onboarding wizard.

### Current Architecture

```
Node.js/Express server (src/server.js → src/app.js)
 ├── API routes (12 feature modules mounted in app.js)
 ├── Socket.io (socket/index.js — rooms `user:{userId}`, JWT-authed)
 ├── BullMQ workers (workers/ping.worker.js, workers/alert.worker.js)
 ├── BullMQ queues (queues/ping.queue.js, queues/alert.queue.js)
 ├── Cron jobs (jobs/retention.job.js — daily purge at 02:00)
 └── Infrastructure singletons (lib/prisma.js, lib/redis.js, lib/logger.js, ...)
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express 4 |
| Frontend | React 19, Vite 6, react-router-dom 7, Recharts 2, Lucide |
| Database | PostgreSQL 16 via Prisma ORM |
| Queue / Jobs | Redis + BullMQ |
| Realtime | Socket.io |
| Auth | bcrypt + JWT (access/refresh), TOTP (otplib), OAuth (passport) |
| Email | Nodemailer (SMTP, Ethereal fallback) |
| Scheduler | node-cron |
| Validation | zod |
| Infra | PM2, Render, Fly.io, Railway |

### Existing Features (fully implemented in 1.0)

- Endpoint monitoring (custom interval 10s–1h, GET default, advanced: method/headers/body/expected codes/keyword/SSL-check)
- UP/DOWN detection + recovery (3-failure threshold), incident open/resolve
- Alerting: email, PagerDuty, webhooks (SLACK/DISCORD/GENERIC + HMAC signing + retries)
- Notification preferences (quiet hours, timezone, toggles)
- Real-time dashboard via Socket.io (`ping:result`, `endpoint:created/updated/deleted`)
- Stats: uptime %, avg response, P95 (`percentile_cont(0.95)`), series
- Public status pages (Redis-cached, 30s TTL) + configurable branding
- Status page subscribers + maintenance windows
- Activity feed (ping logs + alerts)
- Plans & limits (FREE 5 / PRO 25 / BUSINESS 100 monitors; enforced server-side)
- Admin console (users, endpoints, activity, audit, announcements, kill-switch)
- Teams (members, roles, invites, shared endpoints, team status page)
- Incidents (list/detail, updates, acknowledge) — manual CRUD surface
- API keys (`dpk_` bearer), sessions, OAuth, TOTP 2FA
- Data retention (14/45/90 days per plan), graceful shutdown, health check
- 16 frontend pages, onboarding wizard, announcement banner

### Existing Database Models (21)

`User`, `OAuthAccount`, `Session`, `ApiKey`, `Endpoint`, `PingLog`, `Alert`, `Incident`, `IncidentUpdate`, `WebhookConfig`, `WebhookDelivery`, `StatusPageConfig`, `MaintenanceWindow`, `StatusSubscriber`, `NotificationPreference`, `Team`, `TeamMember`, `TeamInvite`, `TeamEndpoint`, `AuditLog`, `PlatformSetting`

### Existing Incident Model — What Exists vs. Missing for 2.0

Today `Incident` = `{ id, endpointId, startedAt, resolvedAt?, durationMs?, acknowledged }` + `IncidentUpdate[]`. State is *derived* (`resolvedAt == null` ⇒ open). Incidents are created/resolved only inside `ping.worker.js`; the incident module is a read/ack/update surface.

**Missing for 2.0:** explicit status/severity fields, `incidentId` on alerts, incident lifecycle Socket.io events, a title/summary, correlation data (deployments, changes, code) — all to be added without breaking existing behavior.

---

## DevPulse 2.0 Vision

> **DevPulse's incident intelligence system.**

DevPulse 2.0 = DevPulse 1.0 monitoring + **GitHub intelligence + AI investigation + root cause analysis + fix verification + historical incident search**.

AI is NOT the product. AI is the reasoning layer inside the incident intelligence system.

### New Capabilities

1. **Git Intelligence** — connect a GitHub repo to an endpoint; retrieve commits, PRs, diffs, changed files, and deployments to answer *"what changed before this incident?"*
2. **Incident Timeline** — auto-built from existing PingLog/Alert/Incident data + deployments: device the sequence `deployment → first failure → incident opened → investigation started`.
3. **AI Investigator** — a tool-calling agent that gathers incident context, evidence, ping data, git changes, and code, producing a structured root-cause report (FACT / INFERENCE / HYPOTHESIS, confidence, affected services, suggested fix, risk).
4. **Fix Verification** — detect a new deployment, compare before/after signals (failure rate, uptime, latency, P95, recurrence) and emit PASS / FAILED / INCONCLUSIVE.
5. **Historical Intelligence** — search prior incidents for similar ones and reuse proven resolutions. Start with PostgreSQL full-text/pattern search; introduce `pgvector` embeddings only if/when semantic similarity is genuinely required.
6. **Investigation UI** — `/incidents/:id/investigation` page rendering the full flow: Incident → Timeline → What happened → What changed → Root cause → Evidence → Suggested fix → Fix verification.

---

## Current Architecture

Same as "Existing DevPulse 1.0 → Current Architecture" above, plus DevPulse 2.0 Phase 1 additions: `investigations` REST module, `Investigation`/`InvestigationEvidence`/`InvestigationToolCall` models, `investigationQueue` + `investigation.worker.js` (stub; AI wiring is Phase 4), and the `ai-service/` FastAPI scaffold. This roadmap is the source of truth; greenfield additions are described below.

---

## Technology Stack

Same as 1.0, **plus**:

| New Layer | Choice | Rationale |
|----------|--------|-----------|
| AI service | Python 3.11 + FastAPI | Isolated, replaceable reasoning layer; existing Node backend calls it over HTTP |
| LLM access | Provider-agnostic via the AI service (OpenAI-compatible API) | No hard coupling to one provider |
| Git hosting | GitHub REST API (Octokit) | GitHub is already wired for OAuth; minimal new surface |
| Similarity search | PostgreSQL (existing) first; `pgvector` later only if needed | Avoid premature infra |
| Schemas | Zod on Node side; Pydantic on AI service side | Validated, structured investigation output |

---

## New DevPulse 2.0 Architecture

```
Node.js/Express (existing app)
 │  new module: investigations (REST + Socket.io events)
 │  new module: github (repo connect, sync, commits, PRs, diffs)
 │  new module: deployments
 │  └─────────────────────────────────────────────┐
 │                                                 │ HTTP (internal, key-auth)
 │  new queues (BullMQ, same Redis):               ▼
 │   incident:investigate ──► ai-service (Python/FastAPI: FastAPI)
 │   incident:verify                                │  tool-calling agent
 │   git:sync                                        │   ├ getIncident()          (via Node HTTP API)
 │   incident:similarity                             │   ├ getPingLogs()/getAlerts()/getTimeline()
 │  new workers: investigation.worker.js,            │   ├ getGitCommit()/getGitDiff()/getChangedFiles()
 │              verify.worker.js, git.worker.js      │   ├ inspectSourceFile()
 │  Cron: deployment-retention, investigation-retry  │   ├ searchSimilarIncidents()
 │                                                   │   └ getHistoricalResolution()
 │  Prisma: new models (see Database Changes)        ▼
 │                                          OpenAI-compatible LLM + (optionally) pgvector
 └───► Frontend (React): new pages
       /incidents/:id/investigation
       settings: GitHub repo connection
```

Communication rules:

- **Node always owns the data.** The AI service never queries PostgreSQL directly; it calls back into the Node API with a server-only token to fetch scoped, sanitized context.
- **Async only.** Heavy work (investigation, verify, git sync) goes through BullMQ queues, never the request path.
- **Scheduled investigations** on incident open are rate-limited/deduped (one active investigation per incident; cost guardrails).

---

## Implementation Status

Legend: `[ ]` not started · `[-]` in progress · `[x]` completed · `[!]` blocked

### Phase 0 — Codebase Analysis
- [x] Repository analyzed (backend, frontend, schema, queues, workers, socket, auth, routes)
- [x] Architecture documented (see sections above)
- [x] Existing functionality verified (schema, 21 models; smoke test exists at `backend/scripts/smoke-test.js`)
- [x] Safe extension points identified
- [x] This roadmap file created

### Phase 1 — Foundation
- [x] AI service scaffold (FastAPI `ai-service/` in repo)
- [x] Prisma models: `Investigation`, `InvestigationEvidence`, `InvestigationToolCall`
- [x] BullMQ queue `incident:investigate` + worker
- [x] `GET/POST /api/investigations` REST surface + ownership scoping
- [x] AI configuration via env (provider, model, base URL, token; presence checked at worker startup, not app boot)
- [-] Structured investigation output schema (Pydantic done in `ai-service/app/schemas.py`; Zod side landed with Phase 4 AI engine) + validation

### Phase 2 — Git Intelligence
- [x] Prisma models: `GitRepository`, `GitCommit`, `GitFileChange`, `Deployment`, `DeploymentCommit`
- [x] GitHub integration module: repo connect/disconnect UI + API (`/api/github/*`)
- [x] `git:sync` queue + worker (fetch commits/PRs/diffs on schedule + on incident open)
- [x] Deployment tracking (API + optional GitHub Actions/status hooks)
- [x] Ownership guard: repo belongs to a user; never expose private repo content to other users or the frontend

### Phase 3 — Incident Intelligence
- [x] Incident timeline builder (PingLog + Alert + Incident + Deployment events, chronological)
- [x] Event correlation (clustering + deployment correlation computed inline in the timeline builder; consumed on-demand by the Phase 4 agent rather than a precompute `incident:similarity` queue)
- [x] Deployment correlation (which deployment precedes the first failure?)
- [x] Historical incident search (PostgreSQL: text search across summaries/root causes, ordered by time window + endpoint similarity first)

### Phase 4 — AI Investigator
- [x] Investigation engine in AI service (tool-calling agent; deterministic mock chain-of-thought fallback when no LLM key is configured)
- [x] AI tools: `get_incident`, `get_timeline`, `get_ping_logs`, `get_alerts`, `get_deployment`, `get_git_commit`, `get_git_diff`, `get_changed_files`, `inspect_source_file`, `search_similar_incidents`, `get_historical_resolution`, `list_recent_investigations`
- [x] Evidence collection (FACT/INFERENCE/HYPOTHESIS provenance)
- [x] Root-cause analysis + confidence scoring
- [x] Suggested fixes + risk + verification plan
- [x] Tool-call auditing (every tool call persisted as `InvestigationToolCall`)
- [x] AI cost controls: dedupe by incident, cap tool calls, timeouts + max token budgets; re-run replaces stale report rows

### Phase 5 — Code Intelligence
- [ ] Relevant-file identification (changed files in window + failure-signal proximity)
- [ ] Code context retrieval (fetch file content from GitHub, cached)
- [ ] Git diff analysis (what the diff touched vs. what failed)
- [ ] Code-aware investigation (agent can inspect candidate source files before concluding)

### Phase 6 — Fix Verification
- [ ] Prisma models: `FixSuggestion`, `FixVerification`
- [ ] Deployment detection after investigation completes
- [ ] Before/after metrics: failure count, uptime, avg latency, P95, incident recurrence
- [ ] Verification engine → PASS / FAILED / INCONCLUSIVE
- [ ] `incident:verify` queue + worker

### Phase 7 — Historical Intelligence
- [ ] Similar-incident search results surfaced inside new investigations
- [ ] Incident embeddings (only if/when PostgreSQL search proves insufficient)
- [ ] pgvector extension + migration (deferred/gated)
- [ ] Historical resolution reuse in AI agent prompt

### Phase 8 — UI
- [ ] `/incidents/:id/investigation` page (Incident → Timeline → What happened → What changed → Root cause → Evidence → Suggested fix → Fix verification)
- [ ] Timeline component (reuse existing design system + `RelativeTime`)
- [ ] Root cause UI (summary, confidence, affected services, FACT/INFERENCE/HYPOTHESIS chips)
- [ ] Evidence UI (tool calls, sources, ping excerpts, git diff)
- [ ] Git changes UI (changed files, commit/PR cards)
- [ ] Suggested fix UI (fix, risk, verification plan; copyable patch/diff)
- [ ] Verification UI (before/after metric comparison + PASS/FAILED/INCONCLUSIVE badge)
- [ ] Settings tab: connect/disconnect GitHub repo + repo status
- [ ] Link from Incident detail/list → Investigation

### Phase 9 — Testing
- [ ] Unit tests (timeline builder, correlation, verification engine, serializers)
- [ ] Integration tests (investigation flow, git sync, API endpoints)
- [ ] AI investigation tests (mock LLM + mock Node API; schema validation of output)
- [ ] Regression tests (extend existing smoke-test pattern; existing 1.0 flows must pass)
- [ ] Security tests (authz boundaries, no leak of repo/token/keys to frontend)
- [ ] Load tests (queue throughput at FREE/PRO/BUSINESS scale)

### Phase 10 — Production
- [ ] Environment configuration documented (`.env.example` additions)
- [ ] Docker (backend + ai-service containers) + docker-compose for local dev
- [ ] CI/CD (GitHub Actions: install, lint, migrate, test, build, deploy)
- [ ] Monitoring/observability of investigation jobs (job counts, failures, latency)
- [ ] Logging (structured; never log secrets/keys)
- [ ] Error handling + retries (queue-level retry/backoff, dead-letter handling)
- [ ] Deployment verification for Render/Fly.io/Railway/PM2

---

## Database Changes

### New models to ADD (no changes to existing tables unless required)

| Model | Purpose | Key fields |
|-------|---------|-----------|
| `Investigation` | One per incident (dedup via unique `incidentId`) | `id, incidentId (unique), status, summary, rootCause, confidence, affectedServices Json, relatedDeploymentId?, relatedCommitId?, changedFiles Json, suggestedFix Json, createdAt, startedAt, completedAt, error?` |
| `InvestigationEvidence` | Evidence items | `id, investigationId, sourceType, sourceKey, title, detail, classification (FACT/INFERENCE/HYPOTHESIS), sourceUrl?, payload Json?, createdAt` |
| `InvestigationToolCall` | AI tool-call audit | `id, investigationId, toolName, arguments Json, result Json?, status, durationMs, createdAt` |
| `GitRepository` | Connected repo | `id, userId, name, owner, fullName, defaultBranch, url, installedAt, lastSyncedAt, status` |
| `GitCommit` | Commit metadata | `id, repositoryId, sha, message, author, authorEmail, authorDate, url` |
| `GitFileChange` | Changed files per commit | `id, commitId, filename, status (added/modified/removed/renamed), additions, deletions, patch?` |
| `Deployment` | Deployment record | `id, userId, repositoryId?, environment, commitSha?, status, deployedAt, completedAt, source (api/actions/hook)` |
| `DeploymentCommit` | Link deployment ↔ commits | `deploymentId, commitId` |
| `FixSuggestion` | Suggested fix | `id, investigationId, title, description, diff?, risk, verificationPlan, createdAt` |
| `FixVerification` | Verification run | `id, fixSuggestionId, deploymentId?, preMetrics Json, postMetrics Json, result (PASS/FAILED/INCONCLUSIVE), ranAt, evidence Json` |

### Extension rules
- Only add `incidentId` links (nullable FK) where needed — never drop/retype existing columns.
- New columns on existing tables are **nullable / additive only** (e.g., `Alert.incidentId?`).
- Each change ships as its own Prisma migration; run `prisma migrate deploy` (never `db push` in production).
- Confirm before adding any index/migration that could lock a hot table (`PingLog`, `Alert`).

---

## API Changes

All new routes are **additive**; existing contracts untouched.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/investigations` | List investigations (user-scoped; admin sees all) | Bearer |
| GET | `/api/investigations/:id` | Detail incl. evidence + tool calls | Bearer |
| POST | `/api/investigations/:id/rerun` | Re-run investigation (rate-limited) | Bearer |
| GET | `/api/investigations/:incidentId/options` | Check whether investigation exists / is running (dedupe helper) | Bearer |
| GET | `/api/github/repos` | List connected repos | Bearer/API key |
| POST | `/api/github/repos` | Connect repo (`owner/name`) | Bearer/API key |
| DELETE | `/api/github/repos/:repositoryId` | Disconnect repo | Bearer/API key |
| GET | `/api/github/repos/:repositoryId/commits` | List synced commits | Bearer/API key |
| GET | `/api/github/repos/:repositoryId/deployments` | List deployments | Bearer/API key |
| POST | `/api/deployments` | Record a deployment (source optional) | Bearer/API key |
| GET | `/api/incidents/:id/timeline` | Auto-built timeline | Bearer |
| GET | `/api/incidents/:id/similar` | Similar historical incidents | Bearer |
| POST | `/api/incidents/:id/verify` | Trigger fix verification | Bearer |
| GET | `/api/fix-verifications/:id` | Verification result | Bearer |
| GET | `/api/ai/health` | AI service connectivity (admin) | Admin |

### Internal AI-service contract (server-to-server, not public)
The AI service calls back to `POST /api/internal/ai-context` with a service token to fetch scoped incident/git data. This route **must not** be reachable by normal users; guarded by a dedicated `AI_SERVICE_TOKEN` header check.

---

## AI Tools

The investigator is a tool-calling agent. Every call is recorded (`InvestigationToolCall`). Only scoped, necessary context is provided — never the raw database.

| Tool | Purpose |
|------|---------|
| `getIncident()` | Incident header: id, endpoint, status, timestamps, severity |
| `getIncidentEvents()` | Ping/alerts/deployment events around the incident window |
| `getPingLogs()` | Sampled/aggregated ping results (bucketed, capped) |
| `getAlerts()` | Alerts broadcast for the endpoint in the window |
| `getTimeline()` | Ordered timeline of all gathered events |
| `getDeployment()` | Deployment(s) in the window before first failure |
| `getGitCommit()` | Commit metadata for a sha |
| `getGitDiff()` | Diff/patch for a commit (or PR) |
| `getChangedFiles()` | Files changed vs. a baseline commit |
| `inspectSourceFile()` | Cached file content for a path at a sha |
| `searchSimilarIncidents()` | Similar past incidents + resolution |
| `getHistoricalResolution()` | The fix + verification that resolved a similar incident |

### Investigation output (structured, validated)

```json
{
  "summary": "...",
  "rootCause": "...",
  "confidence": 0.87,
  "evidence": [],
  "affectedServices": [],
  "relatedDeployment": "...",
  "relatedCommit": "...",
  "changedFiles": [],
  "suggestedFix": "...",
  "risk": "...",
  "verificationPlan": "..."
}
```

Validated with **Zod** (Node) and **Pydantic** (AI service). The agent must tag every evidence item `FACT | INFERENCE | HYPOTHESIS` and must not present speculation as fact.

---

## Environment Variables

New variables (all optional at app boot; required only when the feature is used):

```
# AI service
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=<shared secret between Node and AI service>
AI_PROVIDER=openai-compatible          # organization-neutral
AI_BASE_URL=https://api.openai.com/v1  # or any OpenAI-compatible endpoint
AI_MODEL=gpt-4o-mini                   # small default; large model used for deep investigations
AI_DEEP_MODEL=gpt-4o
AI_MAX_TOOL_CALLS=25                   # cost guardrail
AI_TIMEOUT_MS=120000
AI_TEMPERATURE=0.2

# GitHub
GITHUB_TOKEN=<fine-grained PAT with repo read:contents scope>
GITHUB_APP_ID=                         # optional: GitHub App auth instead of PAT
GITHUB_APP_PRIVATE_KEY=

# Verifications
VERIFY_SAMPLE_MINUTES=60               # metrics window before/after deployment
VERIFY_FAILURE_DROP_RATIO=0.3          # min relative improvement to call PASS
```

`.env.example` will be extended (additive) with all of these documented.

---

## Security Considerations

- **Never** send API keys, GitHub tokens, LLM keys, or passwords to the frontend. Secrets live only in env vars / server memory.
- The AI service authenticates to the Node API with `AI_SERVICE_TOKEN` (constant-time compare); Node authenticates to the AI service with the same shared secret via header.
- Ownership boundaries respected everywhere: investigations/git/deployments scoped to `req.user.id` (ADMIN + admin console exclusion like existing modules).
- GitHub tokens rotate; `GITHUB_TOKEN` validated at connect-time; private repo content is fetched server-side only and cached briefly.
- Do not send full private source trees to the LLM — only the files the agent explicitly requests, capped by size, with sensitive-looking content (secrets, credentials) redacted.
- Sanitize all logs: never log tokens, bodies that may contain secrets, or raw LLM prompts with user data.
- AI cost controls: one active investigation per incident, per-investigation tool-call cap, provider/model configurable, small models for summarization/similarity tasks.

---

## Testing Status

| Item | Status |
|------|--------|
| Existing 1.0 smoke test (`backend/scripts/smoke-test.js`) | Passing — 27/27 (incl. Redis-gated investigation flow: trigger, 409 dedupe, list, terminal state, 404) |
| Phase 2 smoke coverage (git + deployments, Redis-gated) | Passing — 50/50 total |
| Phase 3 smoke coverage (timeline + similar, Redis-gated) | Passing — 64/64 total |
| Unit tests | Not started |
| Integration tests | Not started |
| AI investigation tests | Not started |
| Regression coverage for 2.0 | Not started |
| Frontend build check (`npm --prefix frontend run build`) | Passing — 2359 modules, vite build OK |
| Backend startup check (`npm --prefix backend run dev`) | Passing — investigation worker + Redis connected |

---

## Known Issues

- No dedicated test framework (jest/vitest) is configured — only the smoke-test script. A decision is needed: add `vitest`/`jest` for new unit tests (recommended, additive) or extend the smoke-test pattern.
- `Alert` rows are not linked to incidents; deliveries (email/webhook) are not tracked on the `Alert` row. 2.0 links them additively (nullable `incidentId`).
- Existing incident module emits no Socket.io events; 2.0 adds `incident:investigation_started`, `incident:investigation_completed` events (additive).
- GitHub OAuth exists for login; a separate machine `GITHUB_TOKEN` is used for repo sync to avoid coupling investigation reads to user sessions.
- AI service is a separate process → deployment orchestrations (Docker/docker-compose, Render, Fly.io) must be updated to run it; PM2 config gains a second app entry.

---

## Decisions & Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Python/FastAPI AI service instead of Node | Isolation + replaceability of the reasoning layer; keeps Node app lean; matches prompt requirement |
| AI service calls Node API (not DB) for context | Single owner of data; enforced authz; the AI can never touch unrelated rows |
| Tool-calling agent over monolithic prompt | Auditable (`InvestigationToolCall`), controllable context, evidence tagging possible |
| PostgreSQL search first, pgvector deferred | Avoid premature infrastructure; semantic search only if required |
| GitHub REST + PAT first, App auth later | Fast to ship, additive swap later |
| New models as separate tables (not altering Incident) | Zero breakage of 1.0 API/UI; join via nullable `incidentId` keys |
| One investigation per incident (unique `incidentId`) | Dedup + cost control |
| All heavy work in BullMQ (same Redis) | Reuses existing infra, no new queue system |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-09-05 | Phase 0 complete. Codebase analyzed; `DEVPULSE_2_ROADMAP.md` created. No production code modified. |
| 2026-09-05 | Phase 1 shipped: Prisma `Investigation`/`InvestigationEvidence`/`InvestigationToolCall` + migration `20260905000000_add_investigation_models`; `investigationQueue` + `investigation.worker.js` (stub fails investigation until Phase 4); `ai.service.js`; `modules/investigations` REST (list/detail/trigger/rerun, ownership-scoped, 409 dedupe); wired in `app.js`/`server.js`; auto-trigger on incident DOWN in `ping.worker.js` (additive); `ai-service/` FastAPI scaffold with token-gated `/health` + Pydantic schemas; AI + GitHub env vars in `.env.example`/`config/env.js`; smoke test 27/27 PASS; frontend build PASS; worker hardened for stale jobs (deleted-incident). |
| 2026-09-06 | Phase 3 shipped: `Alert.incidentId?` nullable FK (migration `20260906000010_add_alert_incident_link`); alert worker links DOWN/UP alerts to incidents; incident module gains `GET /api/incidents/:id/timeline` (chronological events from PingLog/Alert/IncidentUpdate/Deployment + failure clustering + deployment correlation) and `GET /api/incidents/:id/similar` (PostgreSQL full-text over investigation summaries/root causes, endpoint-similarity + text-relevance ordering, ownership-scoped); smoke test 64/64 PASS. |
| 2026-09-06 | Phase 4 shipped (AI Investigator): token-gated `/api/internal/ai-context` module with 12 agent tool resolvers (incident, ping logs, alerts, timeline, deployment, git commit/diff/changed-files, source-file inspect, similar-incident search, historical resolution, recent investigations) all ownership-scoped by the incident's endpoint user; `Post /investigate` in `ai-service` runs a tool-calling agent (OpenAI-compatible chat completions with tools) with a deterministic mock chain-of-thought fallback when no `AI_API_KEY` is set — both real-effecting the same internal tools so evidence + tool audits are realistic; `backend/src/schemas/ai-result.schema.js` Zod contract; `investigation.worker.js` now validates + persists `Investigation` (summary, rootCause, confidence, affectedServices, related commit/deployment, changedFiles, suggestedFix, risk, verificationPlan) + `InvestigationEvidence` + `InvestigationToolCall` rows and emits `investigation:*` socket events; re-run replaces stale report rows; cost guardrails (max tool calls, token budget, timeouts, 402 budget error, 409 dedupe); similarity search switched to OR-conjoined `to_tsquery` so text relevance stays non-zero against rich AI summaries; fixed a BullMQ re-add no-op that silently prevented re-running a completed investigation; smoke test 82/82 PASS (spawns ai-service in mock mode end-to-end). |

---

## Current Task

Phase 2 complete. Note: WSL2 Redis localhost-forwarding is unreliable on this box (corp VPN/firewall) — use the Docker `devpulse-redis` container on `127.0.0.1:6379` (WSL `redis-server` stopped + disabled). Phase 3 (Incident Intelligence): timeline builder, event clustering + deployment correlation, historical incident search — shipped inline in the incident module (`GET /api/incidents/:id/timeline`, `GET /api/incidents/:id/similar`); consumed on-demand by the Phase 4 agent rather than a dedicated `incident:similarity` queue. Phase 4 (AI Investigator) shipped: tool-calling agent in `ai-service` (`POST /investigate`, token-gated), 12 internal AI-context tools on the Node API, Zod validation, evidence + tool-call persistence, socket events, cost controls, mock mode for keyless dev boxes; smoke test 82/82 PASS.

## Next Task

Phase 5 — Code Intelligence (repository-level blame/anomaly detection, per-file change attribution, deployment-aware changelog diffing) or Phase 8 investigation UI if a visible surface is wanted first.

---

## Last Updated

2026-09-05