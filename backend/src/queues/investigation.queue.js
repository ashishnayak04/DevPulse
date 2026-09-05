const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const investigationQueue = new Queue('investigationQueue', { connection: redis });

function buildInvestigationJobId(incidentId) {
  return `investigate-${incidentId}`;
}

async function enqueueInvestigation({ incidentId, endpointId, userId }) {
  await investigationQueue.add(
    'investigate',
    { incidentId, endpointId, userId },
    {
      jobId: buildInvestigationJobId(incidentId),
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 10 },
    }
  );
}

module.exports = { investigationQueue, enqueueInvestigation, buildInvestigationJobId };