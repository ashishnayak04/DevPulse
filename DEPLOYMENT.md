# DevPulse Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 16+ and Redis 7+ (for self-hosted deploy)
- Git

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Generate strong JWT secrets:

```bash
openssl rand -base64 32
```

---

## Option 1: Render.com (Easiest)

1. Push your code to a GitHub repo.
2. Go to [render.com](https://render.com) and click **New > Blueprint**.
3. Connect your repo — Render auto-detects `render.yaml` (native Node build, no Docker).
4. Set the **SMTP_USER**, **SMTP_PASS**, and **SMTP_FROM_EMAIL** environment variables in the dashboard (they're marked as `sync: false`).
5. Click **Deploy**.

Render will provision:
- A Node web service (the app)
- A PostgreSQL database
- A Redis instance

Your app will be live at `https://devpulse.onrender.com`.

### Updating SMTP Secrets

After the first deploy, go to your Render dashboard:
- **Environment > Secret Files** — add `.env` with your SMTP credentials
- Or set individual env vars for `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`

---

## Option 2: Fly.io

Fly.io deploys Node.js apps natively using buildpacks (no Dockerfile required).

### Setup

```bash
# Install flyctl
# Windows: powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login

# Launch (creates fly.toml)
fly launch --no-deploy
```

### Deploy

```bash
# Set secrets
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
  FRONTEND_URL="https://your-app.fly.dev"

# Create PostgreSQL and Redis
fly postgres create --name devpulse-db
fly postgres attach --postgres-app devpulse-db

fly redis create --name devpulse-redis
fly redis attach --redis-app devpulse-redis

# Deploy
fly deploy
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

# Install deps
npm run install:all

# Configure env
cp backend/.env.example backend/.env
nano backend/.env  # fill in production values

# Run migrations
npm --prefix backend run db:migrate:deploy

# Generate Prisma client
npm --prefix backend run db:generate

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # enables auto-start on reboot
```

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
3. Add **PostgreSQL** and **Redis** plugins.
4. Set all environment variables in the dashboard (use `backend/.env.example` as reference).
5. In the **Deploy** settings:
   - **Build command:** `npm run build`
   - **Start command:** `npm run db:migrate:deploy && npm start`
6. Railway auto-deploys from your default branch.

---

## Production Checklist

- [ ] Generate strong JWT secrets (at least 32 chars, random)
- [ ] Replace SMTP credentials with production email/app password
- [ ] Set `NODE_ENV=production`
- [ ] Set `FRONTEND_URL` to the actual production URL
- [ ] Enable HTTPS (Render/Fly/Railway do this automatically; Nginx+Certbot for VPS)
- [ ] Set up monitoring (optional): Sentry, Datadog, or a free status monitor
- [ ] Configure database backups (Render/Railway have built-in; for VPS use `pg_dump` cron)
- [ ] Adjust rate limit in `src/middleware/rate-limiters.js` if needed (default: 100 req/min per IP)
