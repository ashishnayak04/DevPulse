const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const logger = require('../../lib/logger');
const { recordAudit } = require('../../lib/audit');
const { enqueueGitSync } = require('../../queues/git.queue');
const { validateRepository } = require('../../services/github.service');

const repositorySelect = {
  id: true,
  name: true,
  owner: true,
  fullName: true,
  defaultBranch: true,
  url: true,
  description: true,
  status: true,
  lastError: true,
  installedAt: true,
  lastSyncedAt: true,
  _count: { select: { commits: true, deployments: true } },
};

function parseListQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, constants.pagination.maxLimit);
  return { page, limit };
}

async function assertRepositoryLimit(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const limits = constants.plans[user.plan] || constants.plans.FREE;
  const count = await prisma.gitRepository.count({ where: { userId } });
  if (count >= limits.maxRepositories) {
    throw new HttpError(
      `Your ${user.plan} plan allows up to ${limits.maxRepositories} connected repositories. Upgrade your plan to add more.`,
      { statusCode: 403, code: 'PLAN_LIMIT_REACHED' }
    );
  }
}

async function assertOwnedRepository(repositoryId, userId) {
  const repository = await prisma.gitRepository.findFirst({
    where: { id: repositoryId, userId },
    select: { id: true, userId: true, fullName: true },
  });
  if (!repository) {
    throw new HttpError('Repository not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return repository;
}

async function listRepositories(user, rawQuery) {
  const { page, limit } = parseListQuery(rawQuery);
  const where = { userId: user.id };

  const [items, total] = await Promise.all([
    prisma.gitRepository.findMany({
      where,
      orderBy: { installedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: repositorySelect,
    }),
    prisma.gitRepository.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function connectRepository(user, { owner, name }) {
  await assertRepositoryLimit(user.id);

  const repo = await validateRepository(owner, name);

  const existing = await prisma.gitRepository.findUnique({
    where: { userId_fullName: { userId: user.id, fullName: repo.fullName } },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError('Repository is already connected', { statusCode: 409, code: 'REPOSITORY_ALREADY_CONNECTED' });
  }

  const created = await prisma.gitRepository.create({
    data: {
      userId: user.id,
      fullName: repo.fullName,
      name: repo.name,
      owner: repo.owner,
      defaultBranch: repo.defaultBranch,
      url: repo.url,
      description: repo.description,
      status: 'active',
    },
    select: repositorySelect,
  });

  recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'GITHUB_REPO_CONNECT',
    targetType: 'GitRepository',
    targetId: created.id,
    metadata: { fullName: repo.fullName },
  });

  enqueueGitSync({
    repositoryId: created.id,
    userId: user.id,
    fullName: repo.fullName,
    reason: 'connect',
  }).catch((err) => logger.error('GitHubModule', `Initial sync enqueue failed for ${repo.fullName}: ${err.message}`));

  return created;
}

async function disconnectRepository(repositoryId, userId, actorEmail) {
  const repository = await assertOwnedRepository(repositoryId, userId);

  await prisma.gitRepository.delete({ where: { id: repositoryId } });

  recordAudit({
    actorId: userId,
    actorEmail,
    action: 'GITHUB_REPO_DISCONNECT',
    targetType: 'GitRepository',
    targetId: repositoryId,
    metadata: { fullName: repository.fullName },
  });

  return { message: `Repository ${repository.fullName} disconnected` };
}

async function syncRepositoryNow(repositoryId, userId) {
  const repository = await assertOwnedRepository(repositoryId, userId);

  await prisma.gitRepository.update({
    where: { id: repositoryId },
    data: { status: 'active', lastError: null },
  });

  await enqueueGitSync({
    repositoryId,
    userId,
    fullName: repository.fullName,
    reason: 'manual',
  });

  return { message: `Sync for ${repository.fullName} queued` };
}

async function listRepositoryCommits(repositoryId, userId, rawQuery) {
  const repository = await assertOwnedRepository(repositoryId, userId);
  const { page, limit } = parseListQuery(rawQuery);

  const [items, total] = await Promise.all([
    prisma.gitCommit.findMany({
      where: { repositoryId },
      orderBy: { authorDate: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true,
        sha: true,
        message: true,
        author: true,
        authorEmail: true,
        authorDate: true,
        url: true,
        _count: { select: { fileChanges: true } },
      },
    }),
    prisma.gitCommit.count({ where: { repositoryId } }),
  ]);

  return { repository: { id: repository.id, fullName: repository.fullName }, items, total, page, limit };
}

async function listRepositoryDeployments(repositoryId, userId, rawQuery) {
  const repository = await assertOwnedRepository(repositoryId, userId);
  const { page, limit } = parseListQuery(rawQuery);

  const where = { repositoryId };

  const [items, total] = await Promise.all([
    prisma.deployment.findMany({
      where,
      orderBy: { deployedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        commits: { include: { commit: { select: { sha: true, message: true, authorDate: true } } } },
      },
    }),
    prisma.deployment.count({ where }),
  ]);

  return { repository: { id: repository.id, fullName: repository.fullName }, items, total, page, limit };
}

module.exports = {
  listRepositories,
  connectRepository,
  disconnectRepository,
  syncRepositoryNow,
  listRepositoryCommits,
  listRepositoryDeployments,
};