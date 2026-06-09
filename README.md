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
| Infra       | Docker Compose |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### 1. Clone & install

```bash
git clone https://github.com/ashishnayak04/devpulse.git
cd devpulse
npm install
cd client && npm install && cd ..
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on `:5432` and Redis on `:6379`.

### 3. Configure environment

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

### 4. Database setup

```bash
npx prisma migrate dev --name init
```

### 5. Start the app

**Backend:**
```bash
npm run dev
```

**Frontend (separate terminal):**
```bash
cd client && npm run dev
```

Open `http://localhost:5173`, register an account, and start adding endpoints.

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
| GET | `/api/health` | Health check |

## Project Structure

```
src/
├── controllers/     # Route handlers
├── jobs/            # Cron scheduler
├── middleware/      # Auth, error handling
├── routes/          # Express route definitions
├── services/        # Business logic
├── utils/           # Prisma client, helpers
├── workers/         # BullMQ workers (ping, alert)
└── index.js         # App entry point

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
