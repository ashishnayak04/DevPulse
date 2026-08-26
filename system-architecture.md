# DevPulse — System Architecture

**Version:** 1.0.0  
**Scope:** Backend (Node.js/Express) + Frontend (React/Vite) + Infra (PostgreSQL, Redis, BullMQ)

---

## 1. System Overview

DevPulse is a client–server web application. A single Node.js process hosts an Express API, a Socket.io realtime server, and two BullMQ background workers. Persistent state lives in PostgreSQL (via Prisma ORM); Redis provides the job queue broker and the status-page cache. The React SPA is served by Express from `frontend/dist` in production.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            React SPA (Vite)                             │
│   Dashboard · Endpoint Detail · Activity · Settings · Status Page       │
└───────────────▲───────────────────────────────▲─────────────────────────┘
                │ REST (fetch, Bearer JWT)      │ Socket.io (JWT handshake)
┌───────────────┴───────────────────────────────┴─────────────────────────┐
│                           Node.js Process                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Express App (app.js)                                             │  │
│  │  modules/<feature>/ (routes ─▶ controllers ─▶ services)          │  │
│  │  helmet · cors · morgan · cookieParser · rate-limit · zod validate │  │
│  │  static: frontend/dist · SPA fallback · /api/health                  │  │
│  └───────────────▲──────────────────────────────────────┬────────────┘  │
│                  │                                      │              │
│  ┌───────────────┴──────────────────┐   ┌───────────────▼────────────┐  │
│  │ Socket.io Server                │   │ BullMQ Producers            │  │
│  │  io.use(socketAuth)             │   │  pingQueue (repeatable)     │  │
│  │  room: user:<userId>            │   │  alertQueue                 │  │
│  └──────────────────┬──────────────┘   └───────────────┬────────────┘  │
└─────────────────────┼──────────────────────────────────┼───────────────┘
                      │            Redis                 │
                      │  ┌─────────────────────────────┐ │
                      └──│ status cache (TTL 30s)      │ │
                         │ pingQueue / alertQueue      │◀┘
                         └──────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                  Node.js Process                   │
              │  ┌─────────────────────────┐  ┌─────────────────┐ │
              │  │ ping.worker             │  │ alert.worker    │ │
              │  │ concurrency 10          │  │ concurrency 5   │ │
              │  │ HTTP GET → PingLog      │  │ email + webhook │ │
              │  └────────────┬────────────┘  │ retries + audit │ │
              │               │               └────────┬────────┘ │
              └───────────────┼────────────────────────┼──────────┘
                              ▼                        ▼
                    ┌────────────────────────────────────────────┐
                    │            PostgreSQL 16 (Prisma)          │
                    │  User · Endpoint · PingLog · Alert ·       │
                    │  WebhookConfig · WebhookDelivery           │
                    └────────────────────────────────────────────┘
```

## 2. Component Responsibilities

### 2.1 Express API (`src/`)
Serves REST endpoints and the SPA. The HTTP surface is split into a testable app factory (`app.js`) and a bootstrap (`server.js`).

- **`app.js`** — Express app factory: global middleware (helmet, cors, morgan, cookie-parser, json), `/api` rate limiter, static SPA serving, route mounting, SPA fallback, error handler.
- **`server.js`** — Entry point: creates the HTTP server + Socket.io, connects Prisma, starts workers/cron, listens, handles graceful shutdown.
- **`modules/<feature>/`** — Feature-scoped folders each bundling controller, routes, service, and validators:
  - `auth/` — register, login, refresh, logout (5 req/min).
  - `endpoints/` — endpoint CRUD (all `verifyToken`).
  - `stats/` — `GET /:id/stats`.
  - `activity/` — `GET /:id/logs`, `GET /activity/logs`.
  - `status/` — public `GET /:username`.
- **`controllers`** — HTTP adapters: parse/validate input, call services, shape JSON responses (`{ success, data }` / `{ success: false, error: { code, message } }`).
- **`services`** — Business logic including scheduling side-effects on create/update/delete.
- **`validators`** — Zod schemas extracted from routes.
- **`middleware/`**
  - `authenticate.js` — `verifyToken` (Bearer JWT) and `socketAuth` (Socket.io handshake).
  - `validate.js` — Zod schema middleware → `400 VALIDATION_ERROR`.
  - `error-handler.js` — Prisma `P2002`→409, `P2025`→404, generic → status/code.
  - `rate-limiters.js` — shared `apiLimiter` / `authLimiter`.
- **`lib/`** — Infrastructure singletons: `prisma.js`, `redis.js`, `jwt.js`, `logger.js`, `http-error.js`.
- **`config/env.js`** — Centralized environment config (validated in production).

### 2.2 Realtime (`src/socket/`)
- `createSocketServer(server)` attaches Socket.io; JWT required on handshake (`socketAuth`).
- Each authenticated socket joins `user:<userId>`.
- `ping.worker` emits `ping:result` to `user:<userId>` after every check → live dashboard updates.

### 2.3 Queues (`src/queues/`)
- `ping.queue.js` — owns `pingQueue`; `schedulePing` adds a **repeatable** job `ping:<endpointId>` with `repeat.every = intervalMs`; removes old job first (dedup). `removePing` / `reschedulePing` manage job lifecycle; `scheduleAllActive` re-registers active endpoints at startup.
- `alert.queue.js` — owns `alertQueue`.

### 2.4 Ping Worker (`src/workers/ping.worker.js`)
- Consumes `pingQueue`, concurrency 10.
- Loads the endpoint fresh from DB (skips inactive/deleted).
- Performs `axios.get(url, { timeout: 10000, validateStatus: () => true })`.
- Writes a `PingLog` row (statusCode, responseTimeMs, isUp, checkedAt).
- Updates `Endpoint.consecutiveFailures` and status:
  - success → reset to 0, status `UP`; enqueues `UP` alert if previously `DOWN`.
  - failure → increment; at ≥ 3 while status `UP`, set `DOWN` and enqueue `DOWN` alert.
- Emits `ping:result` via Socket.io; deletes `status:<username>` Redis cache key.

### 2.5 Alert Worker (`src/workers/alert.worker.js`)
- Consumes `alertQueue`, concurrency 5.
- Delegates to `services/alert.service.js`.
- Records an `Alert` row.
- Sends email via Nodemailer (`sendAlertEmail`); dev fallback = Ethereal test account.
- For each user `WebhookConfig`: builds payload, HMAC-SHA256 signs with the config secret, POSTs with `X-DevPulse-Signature`; retries up to 3 times with exponential backoff (60s → 120s); logs a `WebhookDelivery` row per attempt.

### 2.6 Cron (`src/jobs/retention.job.js`)
- `node-cron` job `0 2 * * *` deletes `PingLog` rows older than 90 days (data retention); started by `startRetentionJob()`.

### 2.7 Frontend (`frontend/`)
- **Stack:** React 19, Vite 6, react-router-dom 7, Recharts, Lucide React, socket.io-client.
- **`context/AuthContext.jsx`** — auth state + session persistence.
- **`api.js`** — fetch client; attaches `Authorization: Bearer`; on 401 auto-refreshes via `/auth/refresh` and retries once, else redirects to `/login`.
- **`hooks/useSocket.js`** — Socket.io connection with JWT token.
- **`pages/`** — Login, Register, Dashboard, EndpointDetail, Activity, Settings, StatusPage.
- **`components/`** — Sidebar, EndpointCard, StatCard, ResponseChart, modals, ProtectedRoute, Toast, LoadingSkeleton.

## 3. Data Model (Prisma / PostgreSQL)

```
User 1───* Endpoint 1───* PingLog
 │                      └───* Alert
 └───1───* WebhookConfig 1───* WebhookDelivery
```

### Enums
- `EndpointStatus` → `UP` | `DOWN`
- `AlertType` → `DOWN` | `UP`

### Tables
| Model | Key fields | Notes |
|-------|-----------|-------|
| `User` | `email` (unique), `username` (unique), `passwordHash`, `refreshToken?` | Indices on email, username |
| `Endpoint` | `userId`, `name`, `url`, `intervalMs` (default 60000), `isActive`, `consecutiveFailures`, `status` | Cascade delete; indices on userId, status |
| `PingLog` | `endpointId`, `statusCode?`, `responseTimeMs`, `isUp`, `checkedAt` | Composite index `[endpointId, checkedAt]`; `[checkedAt]` for retention |
| `Alert` | `endpointId`, `type`, `sentAt` | Index on endpointId |
| `WebhookConfig` | `userId`, `url`, `secret` | Index on userId |
| `WebhookDelivery` | `webhookConfigId`, `payload` (Json), `responseStatus?`, `attempt`, `success`, `deliveredAt` | Index on webhookConfigId |

### Indexes / Performance
- Raw SQL aggregation for 24h stats (`COUNT`, `AVG`, `percentile_cont(0.95)`).
- Status-page query limited to one latest ping log per endpoint (subquery `take: 1`).
- Redis cache-aside avoids recomputing status pages on every public hit.

## 4. Security Design

| Control | Implementation |
|---------|----------------|
| Password storage | bcrypt (cost 12) |
| Access tokens | HS256 JWT, 15m expiry, payload `{ id, email, username }` |
| Refresh tokens | HS256 JWT, 7d expiry, stored server-side, rotated on refresh, revoked on logout |
| Cookies | `httpOnly`, `sameSite=lax`, `secure` in production |
| Transport security | Helmet headers (CSP/COEP disabled for SPA build) |
| Rate limiting | Global 100 req/min `/api`; 5 req/min auth routes |
| Input validation | Zod schemas at every write route |
| Authorization | Ownership checks (`userId` match) in services/controllers; 404 on cross-user access |
| Socket auth | JWT verified in Socket.io handshake |
| Webhook integrity | HMAC-SHA256 signature header per config secret |
| Secrets | `.env`-driven; not committed |

## 5. Concurrency & Reliability

- **Job dedup:** repeatable BullMQ jobs keyed `ping:<endpointId>` prevent stacking if rescheduled.
- **Idempotent state machine:** status transitions only fire alerts on change (UP→DOWN, DOWN→UP), avoiding alert storms.
- **Worker isolation:** ping and alert workers are separate BullMQ consumers; failures don't block the web process.
- **Startup recovery:** `scheduleAllActive` re-registers jobs after restart.
- **Retry semantics:** webhook delivery retried (3 attempts, exponential backoff); emails logged on failure but not retried.
- **Retention guard:** scheduled cleanup bounded by 90-day cutoff.

## 6. Deployment Topology

| Artifact | Description |
|----------|-------------|
| `render.yaml` | Render blueprint — native Node service + Postgres + Redis |
| `fly.toml` | Fly.io manifest — buildpack build, no Dockerfile |
| `ecosystem.config.js` | PM2 process manager config |
| `.env` | Runtime secrets (see `.env.example`) |

Environment variables:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_HOST/PORT/USER/PASS/FROM_NAME/FROM_EMAIL`, `PORT`, `FRONTEND_URL`, `NODE_ENV`.

## 7. Request Lifecycle Examples

### Create endpoint (authenticated)
```
PATCH/accept → cors/helmet/morgan/cookieParser/json
→ rate limit (100/min)
→ /api/endpoints POST
→ zod validate (name/url/intervalMs)
→ verifyToken (Bearer JWT → req.user)
→ controller.create → endpoint.service.createEndpoint
   → prisma.endpoint.create → ping.queue.schedulePing (repeatable job)
→ 201 { success, data }
```

### Public status page
```
GET /api/status/:username
→ rate limit
→ controller.getPublicStatus
   → redis.get status:<username>  (hit → return cached, 30s TTL)
   → prisma.user.findUnique + prisma.endpoint.findMany (+ latest ping)
   → redis.setex cache 30s
→ 200 { success, data }
```

### Ping execution (async, no HTTP response)
```
repeatable BullMQ job → ping.worker (concurrency 10)
→ reload endpoint → axios GET (10s timeout)
→ write PingLog → update Endpoint status/failures
→ maybe enqueue alert (UP/DOWN)
→ socket.io emit 'ping:result' → redis.del status:<username>
→ alert.worker → Alert row → email → webhooks (signed, retried, audited)
```

## 8. Known Limitations / Trade-offs

- **Single-instance scheduling:** repeatable BullMQ jobs assume one scheduler; multi-instance deployments need a leader-election strategy or `jobId` dedup (partially mitigates).
- **Email retries:** send failures are logged but not requeued.
- **Webhook UI:** schema + delivery exist, but there is no Settings UI to create `WebhookConfig` records yet.
- **GET-only checks:** no method/body/header customization for monitored requests.
- **90-day log window:** enforced by retention; older history is permanently purged.
