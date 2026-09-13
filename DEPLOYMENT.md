# DevPulse Deployment Guide

DevPulse 2.0 ships two processes:

1. **`web`** — the Node/Express backend (serves the API, React dashboard, BullMQ workers, Socket.io).
2. **`devpulse-ai`** — the Python/FastAPI AI reasoning service (`ai-service/`), called by the backend over HTTP. It calls back into the Node API with a shared `AI_SERVICE_TOKEN` to fetch scoped context — it never touches the database directly.

## Prerequisites

- Node.js 18+
- PostgreSQL 16+ and Redis 7+ (for self-hosted deploy)
- Python 3.11+ (for the ai-service; assures a local venv at `ai-service/.venv`)
- Optional: Docker + Docker Compose for the local stack (`Option 0`)
- Git

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and `ai-service/.env.example` to `ai-service/.env`, then fill in your values:

```bash
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
```

Generate strong JWT secrets:

```bash
openssl rand -base64 32
```

### DevPulse 2.0 variables (all optional; features are inactive when unset)

```
# AI service (shared token — must match between backend and ai-service)
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=<shared secret between Node and AI service>
AI_PROVIDER=openai-compatible          # organization-neutral
AI_BASE_URL=https://api.openai.com/v1  # or any OpenAI-compatible endpoint
AI_MODEL=gpt-4o-mini                   # small default; deep model for deep investigations
AI_DEEP_MODEL=gpt-4o
AI_MAX_TOOL_CALLS=25                   # cost guardrail
AI_TIMEOUT_MS=120000
AI_TEMPERATURE=0.2

# AI service's view of the Node API (used by the AI tools to fetch context)
NODE_API_URL=http://localhost:4000

# GitHub (machine token with repo read:contents; optional GitHub App auth)
GITHUB_TOKEN=
GITHUB_APP_ID=            # optional, mutually exclusive with GITHUB_TOKEN
GITHUB_APP_PRIVATE_KEY=   # optional

# Fix verification
VERIFY_SAMPLE_MINUTES=60               # metrics window before/after deployment
VERIFY_FAILURE_DROP_RATIO=0.3          # min relative improvement to call PASS

# Logging (log access/HTTP lines are JSON-encoded in production by default)
LOG_FORMAT=json           # optional: force JSON log lines in any environment
```

`AI_SERVICE_TOKEN` must be identical in `backend/.env` and `ai-service/.env`.

---

## Option 0: Docker Compose (Local Development)

The repo includes `docker-compose.yml` which provisions PostgreSQL, Redis, the web app and the ai-service:

```bash
docker compose up --build
```

- Web: http://localhost:4000
- AI service: http://localhost:8000 (docs at `/docs`, liveness at `/healthz`)
- PostgreSQL on `localhost:5432` and Redis on `localhost:6379`

All secrets come from the host environment or Compose defaults; nothing secret is baked into the images (see `.dockerignore`). `AI_SERVICE_TOKEN`, `AI_API_KEY`, `GITHUB_TOKEN`, etc. are wired through from your shell.

---

## Option 1: Render.com (Easiest)

1. Push your code to a GitHub repo.
2. Go to [render.com](https://render.com) and click **New > Blueprint**.
3. Connect your repo — Render auto-detects `render.yaml`. The Blueprint provisions **two** web services: `devpulse` (native Node) and `devpulse-ai` (Docker).
4. Set the **shared** values in the dashboard (marked `sync: false` in `render.yaml`):
   - `AI_SERVICE_TOKEN` on **both** services (must match)
   - `AI_API_KEY` / `AI_BASE_URL` (optional, on both)
   - `GITHUB_TOKEN` / `GITHUB_HOOK_SECRET` (optional)
   - `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`
5. Click **Deploy**.

Render will provision:
- A Node web service (the app)
- A Docker web service (the AI service)
- A PostgreSQL database
- A Redis instance

Your app will be live at `https://devpulse.onrender.com` and the AI service at `https://devpulse-ai.onrender.com`.

### Updating Secrets

After the first deploy, go to your Render dashboard:
- **devpulse** → **Environment** → set `AI_SERVICE_TOKEN`, `AI_API_KEY`, `GITHUB_TOKEN`, SMTP vars
- **devpulse-ai** → **Environment** → set the **same** `AI_SERVICE_TOKEN`, plus `AI_API_KEY` / `AI_BASE_URL`

---

## Option 2: Fly.io

Fly deploys Node.js apps natively (buildpacks); the AI service runs as a **second app**.

### Setup

```bash
# Install flyctl
# Windows: powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login

# Main app (uses fly.toml)
fly launch --no-deploy

# AI service app (uses fly-ai.toml)
fly launch --config fly-ai.toml --no-deploy
```

### Deploy

```bash
# Main app secrets (Node)
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  JWT_SECRET="..." \
  JWT_REFRESH_SECRET="..." \
  SMTP_HOST="smtp.gmail.com" \
  SMTP_PORT="587" \
  SMTP_USER="your-email" \
  SMTP_PASS="your-app-password" \
  SMTP_FROM_NAME="DevPulse Alerts" \
  SMTP_FROM_EMAIL="your-email" \
  FRONTEND_URL="https://your-app.fly.dev" \
  AI_SERVICE_TOKEN="<shared secret>" \
  AI_SERVICE_URL="https://devpulse-ai.fly.dev" \
  AI_API_KEY="..." \          # optional
  GITHUB_TOKEN="..."           # optional

# AI service secrets
fly secrets set --config fly-ai.toml \
  AI_SERVICE_TOKEN="<same shared secret>" \
  AI_API_KEY="..." \           # optional
  NODE_API_URL="https://devpulse.fly.dev"

# Create PostgreSQL and Redis
fly postgres create --name devpulse-db
fly postgres attach --postgres-app devpulse-db

fly redis create --name devpulse-redis
fly redis attach --redis-app devpulse-redis

# Deploy both apps
fly deploy
fly deploy --config fly-ai.toml
```

### Run Migrations

```bash
fly ssh console -C "npx prisma migrate deploy"
```

---

## Option 3: VPS (Manual with PM2)

### 1. Provision a server (Ubuntu 22.04)

Requirements:
- Node.js 18+
- PostgreSQL 16+
- Redis 7+
- Python 3.11+
- Nginx
- PM2 (`npm install -g pm2`)

### 2. Setup database

```bash
sudo -u postgres psql -c "CREATE USER devpulse WITH PASSWORD 'devpulse';"
sudo -u postgres psql -c "CREATE DATABASE devpulse OWNER devpulse;"
```

### 3. Deploy the app

```bash
# Clone
git clone https://github.com/your-org/devpulse.git
cd devpulse

# Install backend deps
npm run install:all

# Configure env
cp backend/.env.example backend/.env
nano backend/.env  # fill in production values (incl. DevPulse 2.0 vars above)

# Run migrations
npm --prefix backend run db:migrate:deploy

# Generate Prisma client
npm --prefix backend run db:generate

# AI service venv + deps
python3 -m venv ai-service/.venv
ai-service/.venv/bin/pip install -r ai-service/requirements.txt
cp ai-service/.env.example ai-service/.env
nano ai-service/.env  # set AI_SERVICE_TOKEN (same as backend), NODE_API_URL

# Start both processes with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # enables auto-start on reboot
```

`ecosystem.config.js` runs **two** apps: `devpulse` (Node) and `devpulse-ai` (uvicorn on port 8000).

### 4. Nginx reverse proxy

Create `/etc/nginx/sites-available/devpulse`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

The AI service is server-to-server only (port 8000); it does not need to be exposed publicly unless you deploy it on the same VPS and want the Node app to reach it over `http://127.0.0.1:8000`.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/devpulse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Option 4: Railway

1. Push code to GitHub.
2. Go to [railway.app](https://railway.app), click **New Project > Deploy from GitHub repo**.
3. Add **PostgreSQL**, **Redis** and a **Python service** (railway uses a Dockerfile — add the `railway.json`/`Dockerfile` hint pointing at `ai-service/Dockerfile`).
4. Set all environment variables in the dashboard (use `backend/.env.example` as reference). Set `AI_SERVICE_TOKEN` on both the Node and Python services (must match).
5. In the **Deploy** settings for the Node service:
   - **Build command:** `npm run build`
   - **Start command:** `npm run db:migrate:deploy && npm start`
6. Railway auto-deploys from your default branch.

---

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- `lint` — Prisma schema validation, `node --check` over all backend JS (`scripts/check-syntax.js`), `py_compile` over the ai-service.
- `backend-tests` — starts PostgreSQL + Redis services, migrates, runs the full Vitest suite (`npm test`), the queue **load tests** (`node scripts/load-test.js`) and the Redis-gated **smoke test** (spawns the ai-service).
- `frontend-build` — `npm run build` for the React client.
- `ai-service` — installs requirements and verifies `/health` responds in mock mode.
- `deploy` — only on `main`, when `RENDER_DEPLOY_HOOK` is set; triggers a Render deploy.

## Monitoring & Observability

- **Queue metrics** — `GET /api/admin/queues` (ADMIN) reports job counts (wait/active/delayed/completed/failed), dead-lettered job count, recent failures, and completion latency (avg/p50/p95/max) for `pingQueue`, `alertQueue`, `investigationQueue`, `verificationQueue`, `gitQueue`.
- **Logging** — log lines are JSON-encoded when `LOG_FORMAT=json` or `NODE_ENV=production`. Every HTTP request is logged with a `request=` correlation id (`X-Request-Id` header). Secrets are redacted from log output (token/secret/password/key values are masked).
- **Load tests** — `node backend/scripts/load-test.js` measures queue throughput at FREE/PRO/BUSINESS scale (jobs/sec + p50/p95 latency).
- **Health** — web: `/api/health`; ai-service: `/healthz` (liveness, unauthenticated) and `/health` (token-gated, reports Node API connectivity + llm/mock mode).

## Production Checklist

- [ ] Generate strong JWT secrets (at least 32 chars, random)
- [ ] Replace SMTP credentials with production email/app password
- [ ] Set `NODE_ENV=production`
- [ ] Set `FRONTEND_URL` to the actual production URL
- [ ] Set a single shared `AI_SERVICE_TOKEN` on **both** the backend and the ai-service
- [ ] Set `AI_SERVICE_URL` (backend) and `NODE_API_URL` (ai-service) to the right production URLs
- [ ] Configure `GITHUB_TOKEN` (or GitHub App auth) if you want repo intelligence
- [ ] Enable HTTPS (Render/Fly/Railway do this automatically; Nginx+Certbot for VPS)
- [ ] Set up monitoring (optional): Sentry, Datadog, or a free status monitor; check `GET /api/admin/queues` for queue health, `logs/ai-err.log` for AI failures
- [ ] Configure database backups (Render/Railway have built-in; for VPS use `pg_dump` cron)
- [ ] Adjust rate limit in `src/middleware/rate-limiters.js` if needed (default: 100 req/min per IP)
- [ ] Run `node backend/scripts/load-test.js` once after deploy to confirm queue throughput at your plan scale