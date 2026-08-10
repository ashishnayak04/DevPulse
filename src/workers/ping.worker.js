const { Worker } = require('bullmq');
const axios = require('axios');
const prisma = require('../lib/prisma');
const redis = require('../lib/redis');
const logger = require('../lib/logger');
const constants = require('../constants');
const { alertQueue } = require('../queues/alert.queue');
const { invalidateStatusCache } = require('../modules/status/status.service');

const SCOPE = 'PingWorker';

async function performPing(url) {
  const startTime = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: constants.monitoring.pingTimeoutMs,
      validateStatus: () => true,
    });
    return {
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime,
      isUp: response.status >= 200 && response.status < 400,
    };
  } catch (err) {
    logger.debug(SCOPE, `Ping failed for ${url}: ${err.message}`);
    return {
      statusCode: null,
      responseTimeMs: Date.now() - startTime,
      isUp: false,
    };
  }
}

async function enqueueStateTransitionAlert({ endpoint, userId, type, responseTimeMs, failureCount }) {
  await alertQueue.add('alert', {
    endpointId: endpoint.id,
    userId,
    type,
    endpointName: endpoint.name,
    endpointUrl: endpoint.url,
    responseTimeMs,
    failureCount,
  });
}

function emitPingResult(io, userId, result) {
  if (!io) return;
  io.to(`user:${userId}`).emit('ping:result', result);
}

async function invalidateUserStatusCache(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user) {
    await invalidateStatusCache(user.username);
  }
}

function initPingWorker(io) {
  const worker = new Worker(
    'pingQueue',
    async (job) => {
      const { endpointId, url, userId } = job.data;

      const endpoint = await prisma.endpoint.findUnique({ where: { id: endpointId } });
      if (!endpoint || !endpoint.isActive) {
        logger.info(SCOPE, `Endpoint ${endpointId} is inactive or deleted, skipping`);
        return;
      }

      const { statusCode, responseTimeMs, isUp } = await performPing(url);
      const checkedAt = new Date();

      await prisma.pingLog.create({
        data: { endpointId, statusCode, responseTimeMs, isUp, checkedAt },
      });

      let newFailures = endpoint.consecutiveFailures;
      if (isUp) {
        newFailures = 0;
        const previousStatus = endpoint.status;

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: { consecutiveFailures: 0, status: 'UP' },
        });

        if (previousStatus === 'DOWN') {
          await enqueueStateTransitionAlert({ endpoint, userId, type: 'UP', responseTimeMs, failureCount: 0 });
          logger.info(SCOPE, `${endpoint.name} recovered — alert queued`);
        }
      } else {
        newFailures = endpoint.consecutiveFailures + 1;
        const updateData = { consecutiveFailures: newFailures };

        if (newFailures >= constants.monitoring.consecutiveFailuresThreshold && endpoint.status === 'UP') {
          updateData.status = 'DOWN';
          await enqueueStateTransitionAlert({ endpoint, userId, type: 'DOWN', responseTimeMs, failureCount: newFailures });
          logger.info(SCOPE, `${endpoint.name} is DOWN (${newFailures} failures) — alert queued`);
        }

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: updateData,
        });
      }

      emitPingResult(io, userId, {
        endpointId,
        status: isUp ? 'UP' : newFailures >= constants.monitoring.consecutiveFailuresThreshold ? 'DOWN' : 'UP',
        responseTimeMs,
        statusCode,
        isUp,
        checkedAt: checkedAt.toISOString(),
      });

      await invalidateUserStatusCache(userId);

      logger.info(SCOPE, `${endpoint.name} → ${isUp ? 'UP' : 'DOWN'} ${statusCode || 'ERR'} (${responseTimeMs}ms)`);
    },
    {
      connection: redis,
      concurrency: constants.workers.pingConcurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(SCOPE, `Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(SCOPE, `Worker error: ${err.message}`);
  });

  logger.info(SCOPE, 'Started');
  return worker;
}

module.exports = { initPingWorker };
