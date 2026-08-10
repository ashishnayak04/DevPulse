const { Queue } = require('bullmq');
const redis = require('../lib/redis');
const logger = require('../lib/logger');

const pingQueue = new Queue('pingQueue', { connection: redis });

function buildJobId(endpointId) {
  return `ping:${endpointId}`;
}

async function schedulePing(endpoint) {
  const jobId = buildJobId(endpoint.id);

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
      repeat: { every: endpoint.intervalMs },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  logger.info('Scheduler', `Scheduled ping for ${endpoint.name} (${endpoint.url}) every ${endpoint.intervalMs}ms`);
}

async function removePing(endpointId) {
  const jobId = buildJobId(endpointId);
  const repeatableJobs = await pingQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (job.id === jobId) {
      await pingQueue.removeRepeatableByKey(job.key);
      logger.info('Scheduler', `Removed repeatable job for endpoint ${endpointId}`);
    }
  }
}

async function reschedulePing(endpoint) {
  await schedulePing(endpoint);
}

async function scheduleAllActive(prisma) {
  const endpoints = await prisma.endpoint.findMany({ where: { isActive: true } });
  logger.info('Scheduler', `Scheduling ${endpoints.length} active endpoints...`);

  for (const endpoint of endpoints) {
    await schedulePing(endpoint);
  }
}

module.exports = {
  pingQueue,
  schedulePing,
  removePing,
  reschedulePing,
  scheduleAllActive,
};
