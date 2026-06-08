const { Queue } = require('bullmq');
const redis = require('../utils/redis');

const pingQueue = new Queue('pingQueue', { connection: redis });
const alertQueue = new Queue('alertQueue', { connection: redis });

/**
 * Schedule a repeatable ping job for an endpoint.
 * Uses jobId deduplication: "ping:${endpointId}" to prevent stacking.
 */
async function schedulePing(endpoint) {
  const jobId = `ping:${endpoint.id}`;

  // Remove any existing repeatable job first
  await removePing(endpoint.id);

  await pingQueue.add(
    'ping',
    {
      endpointId: endpoint.id,
      url: endpoint.url,
      userId: endpoint.userId,
    },
    {
      jobId,
      repeat: {
        every: endpoint.intervalMs,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  console.log(`[Scheduler] Scheduled ping for ${endpoint.name} (${endpoint.url}) every ${endpoint.intervalMs}ms`);
}

/**
 * Remove a repeatable ping job for an endpoint.
 */
async function removePing(endpointId) {
  const repeatableJobs = await pingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id === `ping:${endpointId}`) {
      await pingQueue.removeRepeatableByKey(job.key);
      console.log(`[Scheduler] Removed repeatable job for endpoint ${endpointId}`);
    }
  }
}

/**
 * Reschedule a ping job (remove old, add new).
 */
async function reschedulePing(endpoint) {
  await schedulePing(endpoint);
}

/**
 * Schedule all active endpoints on startup.
 */
async function scheduleAllActive(prisma) {
  const endpoints = await prisma.endpoint.findMany({ where: { isActive: true } });
  console.log(`[Scheduler] Scheduling ${endpoints.length} active endpoints...`);

  for (const endpoint of endpoints) {
    await schedulePing(endpoint);
  }
}

module.exports = {
  pingQueue,
  alertQueue,
  schedulePing,
  removePing,
  reschedulePing,
  scheduleAllActive,
};
