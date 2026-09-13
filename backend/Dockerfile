# syntax=docker/dockerfile:1
# DevPulse web image: Express backend server + built React client and
# landing page, mounted under one container so the API also serves the UI.
FROM node:20-alpine AS web

WORKDIR /app

# Install workspace deps first (frontend build tooling + backend runtime).
COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install --prefix frontend && npm install --prefix backend

# Copy source (local node_modules/dist are excluded via .dockerignore).
COPY frontend/ frontend/
COPY backend/ backend/
COPY landing/ landing/

# Build the React client (served from frontend/dist by the backend).
RUN npm --prefix frontend run build

WORKDIR /app/backend
EXPOSE 4000

# Booting runs migrations first (prisma migrate deploy is safe to re-run) then
# starts the Express server with its BullMQ workers.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]