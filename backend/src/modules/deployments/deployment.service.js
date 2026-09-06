const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const logger = require('../../lib/logger');
const { enqueueGitSync } = require('../../queues/git.queue');

const allowedStatuses = ['pending', 'in_progress', 'completed', 'failed'];
const allowedSources = ['api', 'github_actions', 'hook'];

function parseListQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, constants.pagination.maxLimit);
  const status = allowedStatuses.includes(query.status) ? query.status : null;
  const environment = query.environment ? String(query.environment) : null;
  return { page, limit, status, environment };
}

async function assertOwnedDeployment(deploymentId, userId) {
  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, userId },
    select: { id: true },
  });
  if (!deployment) {
    throw new HttpError('Deployment not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
}

async function listDeployments(user, rawQuery) {
  const { page, limit, status, environment } = parseListQuery(rawQuery);
  const where = {
    userId: user.id,
    ...(status ? { status } : {}),
    ...(environment ? { environment } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.deployment.findMany({
      where,
      orderBy: { deployedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        repository: { select: { id: true, fullName: true, owner: true, name: true } },
        commits: { include: { commit: { select: { sha: true, message: true, author: true, authorDate: true } } } },
      },
    }),
    prisma.deployment.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function getDeployment(deploymentId, user) {
  await assertOwnedDeployment(deploymentId, user.id);

  return prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      repository: { select: { id: true, fullName: true, owner: true, name: true } },
      commits: { include: { commit: { select: { sha: true, message: true, author: true, authorEmail: true, authorDate: true, url: true } } } },
    },
  });
}

async function linkKnownCommit(deploymentId, repositoryId, commitSha) {
  const commit = await prisma.gitCommit.findUnique({
    where: { repositoryId_sha: { repositoryId, sha: commitSha } },
    select: { id: true },
  });
  if (!commit) return false;

  await prisma.deploymentCommit.upsert({
    where: { deploymentId_commitId: { deploymentId, commitId: commit.id } },
    update: {},
    create: { deploymentId, commitId: commit.id },
  });
  return true;
}

async function createDeployment(user, data) {
  let repository = null;
  if (data.repositoryId) {
    repository = await prisma.gitRepository.findFirst({
      where: { id: data.repositoryId, userId: user.id },
      select: { id: true, userId: true, fullName: true },
    });
    if (!repository) {
      throw new HttpError('Repository not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
  }

  const deployment = await prisma.deployment.create({
    data: {
      userId: user.id,
      repositoryId: repository?.id || null,
      environment: data.environment || 'production',
      commitSha: data.commitSha || null,
      status: data.status || 'completed',
      source: data.source || 'api',
      description: data.description || null,
      deployedAt: data.deployedAt ? new Date(data.deployedAt) : undefined,
      ...(data.status === 'completed' ? { completedAt: new Date() } : {}),
    },
    include: {
      repository: { select: { id: true, fullName: true, owner: true, name: true } },
    },
  });

  if (repository && data.commitSha) {
    const linked = await linkKnownCommit(deployment.id, repository.id, data.commitSha);

    if (!linked) {
      enqueueGitSync({
        repositoryId: repository.id,
        userId: user.id,
        fullName: repository.fullName,
        reason: 'deployment',
      }).catch((err) => logger.error('Deployments', `Git sync enqueue failed for ${repository.fullName}: ${err.message}`));
    }
  }

  return deployment;
}

async function updateDeploymentStatus(deploymentId, user, { status, completedAt }) {
  await assertOwnedDeployment(deploymentId, user.id);

  const deployment = await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      ...(status ? { status } : {}),
      ...(completedAt || (status && (status === 'completed' || status === 'failed')) ? { completedAt: completedAt ? new Date(completedAt) : new Date() } : {}),
    },
    include: {
      repository: { select: { id: true, fullName: true } },
    },
  });

  return deployment;
}

module.exports = {
  listDeployments,
  getDeployment,
  createDeployment,
  updateDeploymentStatus,
};