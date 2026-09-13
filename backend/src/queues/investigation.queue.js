const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const investigationQueue = new Queue('investigationQueue', { connection: redis });

function buildInvestigationJobId(incidentId) {
  return `investigate-${incidentId}`;
}

async function enqueueInvestigation({ incidentId, endpointId, userId }) {
  const jobId = buildInvestigationJobId(incidentId);

  // A completed/failed job leaves its key in Redis, and BullMQ treats a re-add
  // with an existing jobId as a no-op (the job never re-enters the wait list).
  // Service-layer guards prevent re-enqueueing while QUEUED/RUNNING, so it is
  // safe to drop any stale completed/failed job before scheduling the re-run.
  await investigationQueue.remove(jobId).catch(() => {});

  await investigationQueue.add(
    'investigate',
    { incidentId, endpointId, userId },
    {
      jobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 10 },
    }
  );
}

module.exports = { investigationQueue, enqueueInvestigation, buildInvestigationJobId };