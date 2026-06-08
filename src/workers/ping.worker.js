const { Worker } = require('bullmq');
const prisma = require('../utils/prisma');
const axios = require('axios');
const redis = require('../utils/redis');
const { alertQueue } = require('../jobs/scheduler');

let io = null;

/**
 * Initialize the ping worker with Socket.io instance.
 */
function initPingWorker(socketIo) {
  io = socketIo;

  const worker = new Worker(
    'pingQueue',
    async (job) => {
      const { endpointId, url, userId } = job.data;

      const endpoint = await prisma.endpoint.findUnique({ where: { id: endpointId } });
      if (!endpoint || !endpoint.isActive) {
        console.log(`[PingWorker] Endpoint ${endpointId} is inactive or deleted, skipping`);
        return;
      }

      let statusCode = null;
      let responseTimeMs = 0;
      let isUp = false;

      const startTime = Date.now();

      try {
        const response = await axios.get(url, {
          timeout: 10000,
          validateStatus: () => true, // Accept any status code
        });
        responseTimeMs = Date.now() - startTime;
        statusCode = response.status;
        isUp = statusCode >= 200 && statusCode < 400;
      } catch (err) {
        responseTimeMs = Date.now() - startTime;
        isUp = false;
        console.log(`[PingWorker] Ping failed for ${url}: ${err.message}`);
      }

      // Log to PingLog
      const checkedAt = new Date();
      await prisma.pingLog.create({
        data: {
          endpointId,
          statusCode,
          responseTimeMs,
          isUp,
          checkedAt,
        },
      });

      // Update endpoint status
      let newFailures = endpoint.consecutiveFailures;
      if (isUp) {
        newFailures = 0;
        const previousStatus = endpoint.status;

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: {
            consecutiveFailures: 0,
            status: 'UP',
          },
        });

        // Recovery alert: was DOWN, now UP
        if (previousStatus === 'DOWN') {
          await alertQueue.add('alert', {
            endpointId,
            userId,
            type: 'UP',
            endpointName: endpoint.name,
            endpointUrl: endpoint.url,
            responseTimeMs,
            failureCount: 0,
          });
          console.log(`[PingWorker] ✅ ${endpoint.name} recovered — alert queued`);
        }
      } else {
        newFailures = endpoint.consecutiveFailures + 1;

        const updateData = { consecutiveFailures: newFailures };

        // Mark DOWN after 3 consecutive failures
        if (newFailures >= 3 && endpoint.status === 'UP') {
          updateData.status = 'DOWN';

          await alertQueue.add('alert', {
            endpointId,
            userId,
            type: 'DOWN',
            endpointName: endpoint.name,
            endpointUrl: endpoint.url,
            responseTimeMs,
            failureCount: newFailures,
          });
          console.log(`[PingWorker] 🔴 ${endpoint.name} is DOWN (${newFailures} failures) — alert queued`);
        }

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: updateData,
        });
      }

      // Emit Socket.io event to user's room
      if (io) {
        io.to(`user:${userId}`).emit('ping:result', {
          endpointId,
          status: isUp ? 'UP' : (newFailures >= 3 ? 'DOWN' : 'UP'),
          responseTimeMs,
          statusCode,
          isUp,
          checkedAt: checkedAt.toISOString(),
        });
      }

      // Invalidate Redis status page cache for this user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await redis.del(`status:${user.username}`);
      }

      console.log(`[PingWorker] ${endpoint.name} → ${isUp ? '✅' : '❌'} ${statusCode || 'ERR'} (${responseTimeMs}ms)`);
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[PingWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[PingWorker] Worker error:', err.message);
  });

  console.log('[PingWorker] Started');
  return worker;
}

module.exports = { initPingWorker };
