require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
const prisma = require('./utils/prisma');

const { errorHandler } = require('./middleware/errorHandler');
const { socketAuth } = require('./middleware/auth');
const { initPingWorker } = require('./workers/ping.worker');
const { initAlertWorker } = require('./workers/alert.worker');
const { scheduleAllActive } = require('./jobs/scheduler');

// Routes
const authRoutes = require('./routes/auth.routes');
const endpointRoutes = require('./routes/endpoint.routes');
const statsRoutes = require('./routes/stats.routes');
const statusRoutes = require('./routes/status.routes');
const logsRoutes = require('./routes/logs.routes');


const app = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Socket.io JWT auth middleware
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`[Socket.io] User ${socket.userId} connected`);
  socket.join(`user:${socket.userId}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] User ${socket.userId} disconnected`);
  });
});

// ─── Express Middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

// Global API rate limit: 100 req/min
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
    });
  },
});

app.use('/api', apiLimiter);

// ─── Static Files (Frontend — React build) ──────────────
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/endpoints', endpointRoutes);
app.use('/api/endpoints', statsRoutes);
app.use('/api/endpoints', logsRoutes);
app.use('/api/status', statusRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

// SPA fallback — serve React index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(clientBuildPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send('DevPulse API is running. Build the React client for the dashboard UI.');
    }
  }
});

// ─── Error Handler ───────────────────────────────────────
app.use(errorHandler);

// ─── Data Retention Cron ─────────────────────────────────
// Delete PingLog rows older than 90 days — runs daily at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await prisma.pingLog.deleteMany({
      where: { checkedAt: { lt: ninetyDaysAgo } },
    });
    console.log(`[Cron] Deleted ${result.count} PingLog rows older than 90 days`);
  } catch (err) {
    console.error('[Cron] Data retention cleanup failed:', err.message);
  }
});

// ─── Start Server ────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 4000;

async function start() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('[Database] Connected to PostgreSQL');

    // Start workers
    initPingWorker(io);
    initAlertWorker();

    // Schedule all active endpoints
    await scheduleAllActive(prisma);

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`\n🚀 DevPulse server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('[Fatal] Failed to start server:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});
