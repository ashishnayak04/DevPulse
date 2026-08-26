const http = require('http');
const prisma = require('./lib/prisma');
const logger = require('./lib/logger');
const config = require('./config/env');
const { createApp } = require('./app');
const { createSocketServer } = require('./socket');
const { initPingWorker, getPingWorker } = require('./workers/ping.worker');
const { initAlertWorker, getAlertWorker } = require('./workers/alert.worker');
const { scheduleAllActive } = require('./queues/ping.queue');
const { startRetentionJob } = require('./jobs/retention.job');

const SCOPE = 'Server';

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);

  try {
    await prisma.$connect();
    logger.info('Database', 'Connected to PostgreSQL');

    startRetentionJob();
    initPingWorker(io);
    initAlertWorker();
    await scheduleAllActive(prisma);

    server.listen(config.port, () => {
      logger.info(SCOPE, `DevPulse server running on http://localhost:${config.port}`);
      logger.info(SCOPE, `Dashboard: http://localhost:${config.port}`);
      logger.info(SCOPE, `API: http://localhost:${config.port}/api`);
      logger.info(SCOPE, `Health: http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    logger.error(SCOPE, `Fatal error during startup: ${err.message}`);
    process.exit(1);
  }

  const shutdown = async (signal) => {
    logger.info(SCOPE, `Received ${signal}, shutting down...`);
    try {
      server.close();
      const pingW = getPingWorker();
      const alertW = getAlertWorker();
      if (pingW) await pingW.close();
      if (alertW) await alertW.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      logger.error(SCOPE, `Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
