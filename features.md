# DevPulse — Feature Catalog

All implemented and documented capabilities of DevPulse v1.0, grouped by area.

---

## 1. Authentication & Accounts

| Feature | Details | Status |
|---------|---------|--------|
| User registration | Email + username + password (min 8 chars); zod-validated | ✅ |
| Username rules | Lowercase alphanumeric + hyphens, 3–30 chars, uniqueness enforced | ✅ |
| Login | bcrypt-compared email + password | ✅ |
| Logout | Revokes stored refresh token, clears cookie | ✅ |
| Access token | JWT, 15-minute expiry, passed as `Authorization: Bearer` | ✅ |
| Refresh token | JWT, 7-day expiry, httpOnly cookie, rotation on each refresh | ✅ |
| Token revocation | Server-side stored refresh token checked on refresh | ✅ |
| Password hashing | bcrypt, cost factor 12 | ✅ |
| Auth rate limit | 5 req/min on `/api/auth/*` | ✅ |
| Email uniqueness | `409` conflict response | ✅ |

## 2. Endpoint Monitoring

| Feature | Details | Status |
|---------|---------|--------|
| Create endpoint | Name + URL required | ✅ |
| Custom interval | 10,000 ms (10s) to 3,600,000 ms (1h); default 60,000 ms | ✅ |
| HTTP check | GET request, 10s timeout | ✅ |
| Up detection | HTTP status `2xx–3xx` | ✅ |
| Down detection | **3 consecutive failures** → status `DOWN` | ✅ |
| Recovery detection | 1 successful check → status `UP` | ✅ |
| Auto-reschedule | Editing interval/url reschedules the BullMQ job | ✅ |
| Soft delete | `isActive=false` + repeatable job removed | ✅ |
| Ownership checks | Every operation scoped to `req.user.id` | ✅ |

## 3. Alerting & Notifications

| Feature | Details | Status |
|---------|---------|--------|
| DOWN alert | Email + webhooks on transition to DOWN | ✅ |
| UP alert | Email + webhooks on recovery | ✅ |
| Email transport | Nodemailer SMTP; Ethereal test account when unset | ✅ |
| Email templates | Dedicated DOWN / UP HTML templates | ✅ |
| Webhook payloads | `{ event, endpoint, timestamp }` JSON | ✅ |
| Webhook signing | HMAC-SHA256, sent as `X-DevPulse-Signature` | ✅ |
| Webhook retries | Up to 3 attempts, exponential backoff (60s, 120s) | ✅ |
| Delivery audit | Every attempt recorded as `WebhookDelivery` | ✅ |
| Alert persistence | Every alert recorded as `Alert` row | ✅ |

## 4. Real-time Dashboard

| Feature | Details | Status |
|---------|---------|--------|
| Live endpoint list | Cards with status + last response time | ✅ |
| Socket.io updates | `ping:result` emitted to per-user room after each check | ✅ |
| Socket auth | JWT validated on connection handshake | ✅ |
| Endpoint detail | Status, latest latency, recent checks | ✅ |
| Response chart | Recharts time-series of response times | ✅ |
| Ping history | Paginated `PingLog` table (limit ≤ 200) | ✅ |

## 5. Stats & Analytics

| Feature | Details | Status |
|---------|---------|--------|
| Uptime % | Last 24h, ratio of successful checks | ✅ |
| Average response time | Last 24h, rounded to 2 decimals | ✅ |
| P95 latency | PostgreSQL `percentile_cont(0.95)` | ✅ |
| Total checks | Count in window | ✅ |
| Total failures | Count of `isUp=false` in window | ✅ |
| Current status | Included in stats payload | ✅ |

## 6. Public Status Pages

| Feature | Details | Status |
|---------|---------|--------|
| Public route | `GET /api/status/:username` (no auth) | ✅ |
| Per-endpoint status | UP/DOWN, last check time, response time, status code | ✅ |
| Redis cache | Cache-aside, 30s TTL | ✅ |
| Cache invalidation | Redis key deleted after every ping result write | ✅ |
| Frontend page | `/status/:username` route | ✅ |

## 7. Activity Feed

| Feature | Details | Status |
|---------|---------|--------|
| Combined feed | Ping logs + alerts across all endpoints | ✅ |
| Filters | `all`, `failures`, `recoveries` | ✅ |
| Enrichment | Endpoint name/url joined into log rows | ✅ |
| Pagination | `limit` (default 50, max 200) + `offset` | ✅ |

## 8. Reliability & Ops

| Feature | Details | Status |
|---------|---------|--------|
| Job queueing | BullMQ with Redis; ping + alert workers | ✅ |
| Job dedup | Repeatable jobs keyed `ping:<endpointId>` | ✅ |
| Startup reschedule | All active endpoints scheduled on boot | ✅ |
| Data retention | Nightly cron (02:00) deletes ping logs > 90 days | ✅ |
| Health check | `GET /api/health` | ✅ |
| Graceful shutdown | SIGTERM/SIGINT cleanup | ✅ |
| Global rate limit | 100 req/min on `/api` | ✅ |
| Security headers | Helmet (CSP + COEP disabled for SPA) | ✅ |
| SPA serving | Express serves built React app from `frontend/dist` | ✅ |

## 9. Frontend (React)

| Page | Purpose |
|------|---------|
| `/login`, `/register` | Auth screens |
| `/dashboard` | Endpoint cards, live status, add/edit modals |
| `/endpoints/:id` | Detail + charts + logs |
| `/activity` | Filtered activity feed |
| `/settings` | Profile, notification info (webhooks "coming soon" UI) |
| `/status/:username` | Public read-only status page |

UI stack: React 19, Vite 6, react-router-dom 7, Recharts 2, Lucide React, socket.io-client. Auth state via React Context; API via custom fetch client with automatic token refresh on 401.

## 10. Deployment & Infra

| Feature | Details |
|---------|---------|
| Render | `render.yaml` (native Node build) |
| Fly.io | `fly.toml` (buildpacks, no Dockerfile) |
| Railway | Native Node deploy (build + start commands) |
| PM2 | `ecosystem.config.js` |
| Prisma | Migrations in `prisma/migrations/` |

## Roadmap

- Billing / Stripe subscriptions (plan limits already enforced).
- Teams / multi-user workspaces.
- Custom-domain status pages.
- HTTP methods, custom headers, request bodies.
- SMS / push notifications.

## v1.1 Additions

### Plans & Limits (no billing yet)

| Feature | Details | Status |
|---------|---------|--------|
| Plan enum | `FREE` / `PRO` / `BUSINESS` on User; default FREE | ✅ |
| Endpoint caps | 5 / 25 / 100 enforced in create (`PLAN_LIMIT_REACHED` 403) | ✅ |
| Interval floors | FREE ≥ 60s, PRO/BUSINESS ≥ 10s on create + update | ✅ |
| Webhook caps | 1 / 5 / 20 per plan | ✅ |
| Per-plan retention | Nightly purge: 14 / 45 / 90 days by owner plan | ✅ |
| Usage endpoint | `GET /api/endpoints/usage` (plan, limits, usage) | ✅ |
| Admin plan management | Plan dropdown in Admin → Users, audited | ✅ |
| Usage meter | Dashboard header shows plan + monitors used | ✅ |

### Account Security

| Feature | Details | Status |
|---------|---------|--------|
| Email verification | Token hashed SHA-256, 24h expiry, sent on register | ✅ |
| Verify page | `/verify-email?token=` frontend route | ✅ |
| Resend verification | Authed endpoint with cooldown guard | ✅ |
| Verification banner | Settings banner until verified | ✅ |
| Forgot password | Anti-enumeration (always 200), hashed token, 30 min expiry | ✅ |
| Reset password | Revokes refresh tokens; `/reset-password?token=` page | ✅ |
| Branded emails | Verification + reset templates matching alert design | ✅ |

### Webhook Management

| Feature | Details | Status |
|---------|---------|--------|
| CRUD API | `GET/POST/PATCH/DELETE /api/webhooks`, ownership-scoped | ✅ |
| Slack format | `{ text }` payload for SLACK type | ✅ |
| Discord format | `{ content }` payload for DISCORD type | ✅ |
| Generic signed | Original JSON + HMAC `X-DevPulse-Signature` header | ✅ |
| Auto secrets | 24-byte hex secret generated per webhook | ✅ |
| Test delivery | `POST /api/webhooks/:id/test` fire-and-forget | ✅ |
| Delivery audit | Every attempt stored as `WebhookDelivery` (existing) | ✅ |
| Settings UI | List/add/edit/test/delete with confirm dialogs | ✅ |

### Platform Ops

| Feature | Details | Status |
|---------|---------|--------|
| Global kill-switch | `PlatformSetting` singleton; pause/resume all checks | ✅ |
| Worker guard | Ping worker double-checks flag before each check | ✅ |
| Boot awareness | Startup scheduler skips when paused | ✅ |
| Audit log | All admin mutations recorded (actor, action, target, metadata) | ✅ |
| Audit UI | Admin → Audit tab | ✅ |
| Toggle UI | Overview card with Pause/Resume all checks | ✅ |

Run the API smoke test suite anytime:

```bash
cd backend
node scripts/smoke-test.js
```

Note: tests that schedule pings or toggle monitoring require Redis to be running.
