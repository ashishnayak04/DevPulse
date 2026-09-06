const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { enqueueGitSync } = require('../../queues/git.queue');

const SCOPE = 'GitHubHook';

function statusFromState(state) {
  const normalized = String(state || 'pending').toLowerCase();
  if (normalized === 'success' || normalized === 'completed') return 'completed';
  if (normalized === 'failure' || normalized === 'error' || normalized === 'failed') return 'failed';
  if (normalized === 'in_progress' || normalized === 'pending') return 'in_progress';
  return 'pending';
}

async function findRepositoriesForFullName(fullName) {
  return prisma.gitRepository.findMany({
    where: { fullName },
    select: { id: true, userId: true, fullName: true },
  });
}

async function handleDeploymentEvent(payload, rawBody) {
  const deployment = payload.deployment || {};
  const repository = payload.repository || {};
  const fullName = repository.full_name;

  if (!fullName || !deployment.sha) {
    logger.warn(SCOPE, 'Deployment event missing full_name/sha, ignoring');
    return { handled: false, reason: 'missing fields' };
  }

  const repos = await findRepositoriesForFullName(fullName);
  if (repos.length === 0) {
    logger.info(SCOPE, `Deployment event for unconnected repo ${fullName}, ignoring`);
    return { handled: false, reason: 'repo not connected' };
  }

  const deployedAt = deployment.created_at ? new Date(deployment.created_at) : new Date();

  for (const repo of repos) {
    await prisma.deployment.create({
      data: {
        userId: repo.userId,
        repositoryId: repo.id,
        environment: deployment.environment || 'production',
        commitSha: deployment.sha,
        status: 'pending',
        source: 'github_actions',
        description: deployment.description || null,
        deployedAt,
      },
    });

    enqueueGitSync({
      repositoryId: repo.id,
      userId: repo.userId,
      fullName: repo.fullName,
      reason: 'deployment',
    }).catch((err) => logger.error(SCOPE, `Sync enqueue failed for ${repo.fullName}: ${err.message}`));
  }

  logger.info(SCOPE, `Deployment recorded for ${fullName} (${deployment.environment || 'production'} @ ${deployment.sha})`);
  return { handled: true, count: repos.length };
}

async function handleDeploymentStatusEvent(payload) {
  const deployment = payload.deployment || {};
  const deploymentStatus = payload.deployment_status || {};
  const repository = payload.repository || {};
  const fullName = repository.full_name;

  if (!fullName || !deployment.sha) {
    logger.warn(SCOPE, 'Deployment status event missing fields, ignoring');
    return { handled: false, reason: 'missing fields' };
  }

  const repos = await findRepositoriesForFullName(fullName);

  let updated = 0;
  for (const repo of repos) {
    const target = await prisma.deployment.findFirst({
      where: {
        repositoryId: repo.id,
        commitSha: deployment.sha,
        environment: deployment.environment || 'production',
      },
      orderBy: { deployedAt: 'desc' },
      select: { id: true },
    });

    if (!target) continue;

    const status = statusFromState(deploymentStatus.state);
    const isTerminal = status === 'completed' || status === 'failed';

    await prisma.deployment.update({
      where: { id: target.id },
      data: {
        status,
        ...(isTerminal ? { completedAt: deploymentStatus.created_at ? new Date(deploymentStatus.created_at) : new Date() } : {}),
      },
    });
    updated += 1;
  }

  logger.info(SCOPE, `Deployment status "${deploymentStatus.state}" applied to ${updated} deployment(s) for ${fullName}`);
  return { handled: updated > 0, updated };
}

module.exports = { handleDeploymentEvent, handleDeploymentStatusEvent, statusFromState };