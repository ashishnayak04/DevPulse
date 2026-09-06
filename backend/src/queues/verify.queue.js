const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const verificationQueue = new Queue('verificationQueue', { connection: redis });

function buildVerificationJobId(incidentId) {
  return `verify-${incidentId}`;
}

async function enqueueVerification({ incidentId, endpointId, fixSuggestionId, userId }) {
  const jobId = buildVerificationJobId(incidentId);

  // A completed/failed job leaves its key in Redis and BullMQ treats a re-add
  // with an existing jobId as a no-op, so drop any stale job before scheduling.
  await verificationQueue.remove(jobId).catch(() => {});

  await verificationQueue.add(
    'verify',
    { incidentId, endpointId, fixSuggestionId, userId },
    {
      jobId,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 10 },
    }
  );
}

module.exports = { verificationQueue, enqueueVerification, buildVerificationJobId };