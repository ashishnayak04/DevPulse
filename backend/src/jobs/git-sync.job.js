const cron = require('node-cron');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const constants = require('../constants');
const { enqueueGitSync } = require('../queues/git.queue');

const SCOPE = 'GitSyncJob';

async function enqueueScheduledSyncs() {
  try {
    const repos = await prisma.gitRepository.findMany({
      where: { status: 'active' },
      select: { id: true, userId: true, fullName: true },
    });

    for (const repo of repos) {
      enqueueGitSync({
        repositoryId: repo.id,
        userId: repo.userId,
        fullName: repo.fullName,
        reason: 'schedule',
      }).catch((err) => logger.error(SCOPE, `Failed to enqueue sync for ${repo.fullName}: ${err.message}`));
    }

    if (repos.length > 0) {
      logger.info(SCOPE, `Queued scheduled sync for ${repos.length} repo(s)`);
    }
  } catch (err) {
    logger.error(SCOPE, `Scheduled git sync failed: ${err.message}`);
  }
}

function startGitSyncJob() {
  cron.schedule(constants.gitSync.cronExpression, enqueueScheduledSyncs);
  logger.info(SCOPE, `Scheduled git sync at ${constants.gitSync.cronExpression}`);
}

module.exports = { startGitSyncJob, enqueueScheduledSyncs };