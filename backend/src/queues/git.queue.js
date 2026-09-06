const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const gitQueue = new Queue('gitQueue', { connection: redis });

function buildGitSyncJobId(repositoryId) {
  return `git-sync-${repositoryId}`;
}

async function enqueueGitSync({ repositoryId, userId, fullName, reason }) {
  await gitQueue.add(
    'sync',
    { repositoryId, userId, fullName, reason },
    {
      jobId: buildGitSyncJobId(repositoryId),
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 10 },
    }
  );
}

module.exports = { gitQueue, enqueueGitSync, buildGitSyncJobId };