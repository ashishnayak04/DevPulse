# DevPulse — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** August 2026  
**Product Type:** Production-grade API health monitoring SaaS

---

## 1. Overview

DevPulse is a web-based API health monitoring SaaS that lets developers and teams continuously monitor their HTTP endpoints. It pings endpoints at configurable intervals, detects downtime, alerts users via email and webhooks, and exposes real-time dashboards plus shareable public status pages.

### 1.1 Problem Statement

Developers need a simple, self-hostable way to know when their APIs are down or degraded. Existing tools are either too complex, too expensive, or closed-source. DevPulse provides a lightweight, real-time, open-source alternative with a modern UI.

### 1.2 Product Vision

> "Monitor your APIs. Get alerted when they go down. Share your uptime with the world."

## 2. Goals & Success Metrics

### 2.1 Goals
- Reliably detect endpoint outages within a few check intervals.
- Alert users within seconds of a confirmed outage and on recovery.
- Provide a live, real-time view of endpoint health with historical stats.
- Let users share read-only uptime status publicly.
- Be deployable anywhere (Render, Fly.io, Railway, PM2) with minimal setup.

### 2.2 Success Metrics
- **Check reliability:** ping worker uptime / job success rate.
- **Alert latency:** time between outage confirmation and alert delivery.
- **Notification success rate:** % of email and webhook deliveries that succeed.
- **Onboarding time:** minutes from registration to first monitored endpoint.
- **Data freshness:** public status page cache TTL (30s) bounded staleness.

## 3. Target Users & Personas

| Persona | Needs |
|---------|-------|
| **Indie Developer** | Free, quick setup, email + status page for their side project APIs. |
| **SaaS Team** | Multi-endpoint monitoring, real-time dashboard, webhook alerts into Slack/ops tooling, shareable uptime page for customers. |
| **Ops / SRE** | Fast detection (consecutive-failure thresholds), delivery retries, activity audit trail. |

## 4. Core Requirements

### 4.1 Functional Requirements

**FR-1 — Account Management**
- Users register with email, username, password (min 8 chars).
- Users sign in/out with email + password.
- Passwords stored as bcrypt hashes (cost 12).
- Session managed via JWT: 15-minute access token + 7-day rotating refresh token stored in an httpOnly cookie.

**FR-2 — Endpoint Monitoring**
- Create monitored endpoints with a name and valid URL.
- Configurable check interval between 10 seconds and 1 hour (default 60s).
- Ping via HTTP GET with 10s timeout.
- An endpoint is considered **UP** when it returns an HTTP status in `2xx–3xx`.
- A monitored endpoint is declared **DOWN** after **3 consecutive failures**.
- Endpoints can be edited (name/url/interval) and deleted (soft delete via `isActive`).

**FR-3 — Alerting**
- Email notification on DOWN and on UP recovery, using configurable SMTP (Ethereal fallback in dev).
- Webhook notifications to configured URLs with HMAC-SHA256 signature header (`X-DevPulse-Signature`).
- Webhook delivery retries up to 3 attempts with exponential backoff (60s, 120s).
- Every alert and webhook delivery is persisted for the audit trail.

**FR-4 — Live Dashboard**
- List of user's active endpoints with current status and last response time.
- Real-time updates pushed over Socket.io (`ping:result` event) into a per-user room.
- Endpoint detail view with 24h stats: uptime %, avg response time, p95 latency, total checks, total failures.
- Response-time charts (Recharts) and ping history logs (paginated).

**FR-5 — Public Status Pages**
- Read-only page at `/status/:username` showing each active endpoint's current status, last check time, response time, and status code.
- No authentication required.
- Cache-aside with Redis (30s TTL), invalidated on each new ping result.

**FR-6 — Activity Log**
- Combined feed of ping logs and alerts across all endpoints.
- Filters: all, failures, recoveries.
- Pagination (default 50, max 200 per page).

**FR-7 — Data Retention**
- Automatic nightly cleanup (02:00) of `PingLog` rows older than 90 days.

### 4.2 Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| **Performance** | Pings run concurrently (concurrency 10); p95 computed via PostgreSQL `percentile_cont`. |
| **Reliability** | Job queue (BullMQ + Redis) with repeatable jobs; job dedup by `ping:<endpointId>`; retries on webhook delivery. |
| **Security** | Helmet headers, global rate limit 100 req/min, auth routes 5 req/min, ownership verification on every resource, JWT validation, httpOnly cookies, HMAC-signed webhooks. |
| **Scalability** | Workers decoupled from web server via Redis queues; horizontal scaling possible by adding worker processes. |
| **Observability** | Structured console logging (morgan + worker logs), `/api/health` endpoint. |
| **Graceful Shutdown** | SIGTERM/SIGINT → disconnect Prisma, close HTTP server, exit. |

### 4.3 Out of Scope (v1.0)
- Public webhook configuration UI (backend schema + delivery logic exist; UI marked "coming soon" in Settings).
- Multi-region monitoring, SMS / push notifications.
- Teams / organizations / role-based access.
- Endpoint methods beyond GET (POST, HEAD, etc.), custom request bodies/headers.
- SLA reports and uptime history beyond the data-retention window.

## 5. User Stories

1. As a developer, I can register an account and immediately add a URL to monitor so I can see its health.
2. As a user, I get an email when my API goes down after 3 failed checks so I can react quickly.
3. As a user, I get a recovery email when my API comes back up so I know the incident is resolved.
4. As an ops engineer, I can configure a webhook URL and secret so my team's Slack/ops tool is notified automatically.
5. As a developer, I can share `/status/myusername` with customers so they can check uptime without logging in.
6. As a user, I can see uptime %, average latency, and p95 latency over the last 24h per endpoint.
7. As a user, I can filter my activity feed to see only failures or only recoveries.

## 6. Functional Flow — Outage Detection

```
repeatable BullMQ job fires → ping.worker
        │
        ▼
  HTTP GET (timeout 10s)
        │
        ├── status 2xx–3xx  → isUp=true  → reset consecutiveFailures=0 → status=UP
        │                         └─ if previous status was DOWN → enqueue UP alert
        │
        └── else (error / non-2xx-3xx) → isUp=false → consecutiveFailures++
                                          ├─ failures >= 3 AND status=UP → status=DOWN → enqueue DOWN alert
                                          │
        Socket.io 'ping:result' emitted to user room
        Redis status page cache invalidated for this user
```

Alert worker then: records `Alert` row → sends email → iterates webhook configs → signs payload → delivers with retry → records `WebhookDelivery` rows.

## 7. Acceptance Criteria (sample)

- **AC-1:** Registering with an existing email or username returns `409` with a clear message.
- **AC-2:** Creating an endpoint with an invalid URL returns `400 VALIDATION_ERROR`.
- **AC-3:** Interval values outside `10,000–3,600,000` ms are rejected.
- **AC-4:** An endpoint that fails 3 consecutive checks transitions to DOWN and generates one DOWN alert + email/webhooks.
- **AC-5:** After recovery (1 successful check), the endpoint returns to UP and generates one UP alert.
- **AC-6:** `GET /api/status/:username` returns live data within 30s staleness.
- **AC-7:** Unauthenticated requests to protected endpoints return `401`.
- **AC-8:** A user cannot read or mutate another user's endpoint (`404` returned).

## 8. API Surface (summary)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | – | Register |
| POST | `/api/auth/login` | – | Sign in |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/api/auth/logout` | Bearer | Log out, revoke refresh |
| GET/POST | `/api/endpoints` | Bearer | List / create endpoints |
| GET/PATCH/DELETE | `/api/endpoints/:id` | Bearer | Get / update / delete |
| GET | `/api/endpoints/:id/stats` | Bearer | 24h stats |
| GET | `/api/endpoints/:id/logs` | Bearer | Paginated ping logs |
| GET | `/api/endpoints/activity/logs` | Bearer | Combined activity feed |
| GET | `/api/status/:username` | – | Public status page |
| GET | `/api/health` | – | Liveness check |

## 9. Release Plan

- **v1.0 (current):** Full monitoring loop, auth, dashboard, stats, alerts (email), status pages, activity feed, retention cleanup.
- **v1.1 (planned):** Webhook configuration UI, endpoint methods/headers, SMS/push notifications.
- **v2.0 (candidate):** Teams, teams-based status pages, SLA reporting.

## 10. Risks & Open Questions

- **Alert volume:** DOWN/UP alerts fire only on state transitions (not per ping), limiting noise; flapping endpoints could still generate many alerts.
- **Single-node job scheduling:** Repeatable BullMQ jobs must not be scheduled from multiple app instances without care (dedup by `jobId` mitigates stacking).
- **Email deliverability:** Depends on SMTP provider; dev uses Ethereal.
- **Webhook UX:** Config is DB-backed but has no UI yet — needs a Settings UI.
