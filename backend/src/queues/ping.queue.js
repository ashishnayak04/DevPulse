const { Queue } = require('bullmq');
const redis = require('../lib/redis');
const logger = require('../lib/logger');
const { isMonitoringEnabled } = require('../lib/platform-settings');

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

async function removeAllPings() {
  const repeatableJobs = await pingQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    await pingQueue.removeRepeatableByKey(job.key);
  }

  logger.info('Scheduler', `Removed all ${repeatableJobs.length} repeatable ping jobs`);
}

async function scheduleAllActive(prisma) {
  if (!(await isMonitoringEnabled())) {
    logger.warn('Scheduler', 'Global monitoring is disabled — skipping scheduling of active endpoints');
    return 0;
  }

  const endpoints = await prisma.endpoint.findMany({ where: { isActive: true } });
  logger.info('Scheduler', `Scheduling ${endpoints.length} active endpoints...`);

  for (const endpoint of endpoints) {
    await schedulePing(endpoint);
  }

  return endpoints.length;
}

module.exports = {
  pingQueue,
  schedulePing,
  removePing,
  reschedulePing,
  scheduleAllActive,
  removeAllPings,
};
