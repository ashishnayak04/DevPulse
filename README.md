<div align="center">
  <h1>DevPulse</h1>
  <p><strong>Production-grade API health monitoring SaaS</strong></p>
  <p>Monitor your APIs. Get alerted when they go down. Share your uptime with the world.</p>
</div>

## Features

- **Endpoint Monitoring** — Ping any HTTP endpoint at configurable intervals (default: 60s)
- **Real-time Alerts** — Email notifications and webhook deliveries when endpoints go DOWN or recover UP
- **Live Dashboard** — Real-time updates via Socket.io with response-time charts and status history
- **Public Status Pages** — Share a read-only status page at `/status/:username`
- **Activity Log** — Full audit trail of pings, alerts, and webhook deliveries
- **Webhook Integrations** — Configure webhook URLs with secrets for custom alert routing
- **JWT Authentication** — Secure sign-up / sign-in with access + refresh token flow
- **Data Retention** — Automatic cleanup of ping logs older than 90 days
- **Rate Limiting** — Global API rate limit (100 req/min) with Helmet security headers

## Tech Stack

| Layer       | Technology |
|-------------|-----------|
| Backend     | Node.js, Express |
| Frontend    | React 19, Vite, Recharts, Lucide React |
| Database    | PostgreSQL 16 (via Prisma ORM) |
| Queue / Jobs| Redis + BullMQ |
| Realtime    | Socket.io |
| Auth        | bcrypt + JWT (access/refresh tokens) |
| Email       | Nodemailer (SMTP) |
| Scheduler   | node-cron |
| Infra       | Native Node (PM2, Render, Fly.io, Railway) |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### 1. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

Copy `.env` (provided) or create your own:

```env
DATABASE_URL=postgresql://devpulse:devpulse@localhost:5432/devpulse
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password
SMTP_FROM_NAME=DevPulse Alerts
SMTP_FROM_EMAIL=your-email
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Database setup

```bash
npx prisma migrate dev --name init
```

### 3b. Create the admin account

The admin panel is a platform bird's-eye view (all users, all endpoints, system health, platform activity). Create the admin user from the environment variables in `.env`:

```bash
npm run db:seed
```

The seed script reads `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` from `.env` and creates (or resets) an `ADMIN`-role account. Sign in with those credentials to get the Admin section in the sidebar (`/admin`).

### 4. Start the app

**Backend:**
```bash
npm run dev
```

**Frontend (separate terminal):**
```bash
cd client && npm run dev
```

Open `http://localhost:5173`, register an account, and start adding endpoints.

### 5. Stop the servers and free the ports

The app opens three ports locally:

| Port | Service |
|------|---------|
| `4000` | Backend (Express API + Socket.io) |
| `5173` | Frontend (Vite dev server) |
| `6379` | Redis (via Docker container `devpulse-redis`) |

**Option A — Ctrl+C (foreground):** Press `Ctrl+C` in each terminal running `npm run dev`.

**Option B — find and kill the process listening on a port (Windows PowerShell):**

```powershell
# Find the PID listening on a port
netstat -ano | findstr :4000        # e.g. TCP 0.0.0.0:4000 ... LISTENING 1234
netstat -ano | findstr :5173

# Kill it
taskkill /PID 1234 /F
```

**Option C — stop Docker Redis:**

```powershell
docker stop devpulse-redis          # stop the container (restart later with: docker start devpulse-redis)
# Or remove it entirely:
docker rm -f devpulse-redis
```

To bring everything back up later, re-run step 4 (plus `docker start devpulse-redis` if the Redis container was stopped).

### Production build

```bash
cd client && npm run build && cd ..
npm start
```

The Express server serves the built React app from `client/dist`.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/endpoints` | List user's endpoints |
| POST | `/api/endpoints` | Create an endpoint |
| GET | `/api/endpoints/:id` | Endpoint detail + stats |
| PATCH | `/api/endpoints/:id` | Update endpoint |
| DELETE | `/api/endpoints/:id` | Remove endpoint |
| GET | `/api/endpoints/:id/logs` | Ping logs for an endpoint |
| GET | `/api/endpoints/stats/summary` | Aggregate stats |
| GET | `/api/status/:username` | Public status page data |
| GET | `/api/admin/overview` | Platform health + aggregate stats (admin) |
| GET | `/api/admin/users` | All users with counts (admin) |
| PATCH | `/api/admin/users/:id` | Change role / enable / disable a user (admin) |
| DELETE | `/api/admin/users/:id` | Delete a user + their data (admin) |
| GET | `/api/admin/endpoints` | All endpoints across all users (admin) |
| GET | `/api/admin/activity` | Platform-wide check + alert feed (admin) |
| GET | `/api/health` | Health check |

## Project Structure

```
src/
├── server.js          # Entry point — boots HTTP server, socket, workers, cron
├── app.js             # Express app factory (routes, middleware, static)
├── config/            # Centralized environment configuration
├── constants/         # App-wide constants (rate limits, intervals, retention)
├── lib/               # Infrastructure singletons (prisma, redis, logger, jwt)
├── middleware/        # authenticate, error-handler, rate-limiters, validate
├── modules/           # Feature modules (controller + routes + service + validators)
│   ├── auth/
│   ├── endpoints/
│   ├── stats/
│   ├── status/
│   └── activity/
│   └── admin/          # Platform bird's-eye view (overview, users, endpoints, activity)
├── queues/            # BullMQ queue definitions + job scheduling
├── jobs/              # Cron jobs (data retention)
├── workers/           # BullMQ workers (ping, alert)
├── services/          # Cross-cutting services (email, webhook, alert)
├── socket/            # Socket.io server setup
├── templates/         # Email templates
└── utils/             # Small pure helpers (hmac)

client/
└── src/
    ├── components/  # Shared UI components
    ├── context/     # React context (auth)
    ├── hooks/       # Custom hooks
    ├── pages/       # Route pages
    ├── api.js       # Axios client
    └── main.jsx     # React entry point

prisma/
└── schema.prisma    # Database schema
```

## License

MIT
