const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const config = require('../config/env');
const {
  githubConfigured,
  listRepositoryCommits,
  getCommitDetail,
} = require('../services/github.service');

const SCOPE = 'GitWorker';

let gitWorker = null;
let socketIo = null;

function setSocketIo(io) {
  socketIo = io;
}

function emitToUser(userId, event, payload) {
  if (!socketIo || !userId) return;
  socketIo.to(`user:${userId}`).emit(event, payload);
}

async function upsertCommit(repositoryId, commit) {
  return prisma.gitCommit.upsert({
    where: { repositoryId_sha: { repositoryId, sha: commit.sha } },
    update: {
      message: commit.message,
      author: commit.author,
      authorEmail: commit.authorEmail,
      authorDate: commit.authorDate,
      url: commit.url,
    },
    create: {
      repositoryId,
      sha: commit.sha,
      message: commit.message,
      author: commit.author,
      authorEmail: commit.authorEmail,
      authorDate: commit.authorDate,
      url: commit.url,
    },
  });
}

async function syncRepository(repositoryId) {
  const repo = await prisma.gitRepository.findUnique({
    where: { id: repositoryId },
    select: {
      id: true,
      userId: true,
      owner: true,
      name: true,
      fullName: true,
      defaultBranch: true,
      lastSyncedAt: true,
    },
  });

  if (!repo) {
    logger.warn(SCOPE, `Repository ${repositoryId} not found, skipping sync`);
    return null;
  }

  const { data: listData } = await listRepositoryCommits({
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
    since: repo.lastSyncedAt || undefined,
    max: config.github.maxCommitFetch,
  });

  let synced = 0;
  for (const commit of listData.commits) {
    const existing = await prisma.gitCommit.findUnique({
      where: { repositoryId_sha: { repositoryId, sha: commit.sha } },
      select: { id: true },
    });

    const row = await upsertCommit(repositoryId, commit);

    if (!existing) {
      try {
        const detail = await getCommitDetail({ owner: repo.owner, name: repo.name, sha: commit.sha });
        await prisma.gitFileChange.deleteMany({ where: { commitId: row.id } });
        if (detail.files.length > 0) {
          await prisma.gitFileChange.createMany({
            data: detail.files.map((file) => ({ commitId: row.id, ...file })),
          });
        }
      } catch (err) {
        logger.warn(SCOPE, `File-detail fetch failed for ${commit.sha} in ${repo.fullName}: ${err.message}`);
      }
    }
    synced += 1;
  }

  await prisma.gitRepository.update({
    where: { id: repositoryId },
    data: { status: 'active', lastSyncedAt: new Date(), lastError: null },
  });

  return { repo, synced };
}

async function handleGitSyncJob(job) {
  const { repositoryId, userId, fullName } = job.data || {};
  if (!repositoryId) return;

  const repo = await prisma.gitRepository.findUnique({
    where: { id: repositoryId },
    select: { id: true, userId: true },
  });
  if (!repo) {
    logger.warn(SCOPE, `Job ${job.id} references missing repository ${repositoryId}, skipping`);
    return;
  }

  if (!githubConfigured()) {
    const message = 'GitHub not configured (GITHUB_TOKEN missing)';
    await prisma.gitRepository.update({
      where: { id: repositoryId },
      data: { status: 'error', lastError: message },
    });
    emitToUser(repo.userId, 'git:repo_sync_failed', { repositoryId, message });
    logger.error(SCOPE, `Sync ${repositoryId} — ${message}`);
    return;
  }

  try {
    await prisma.gitRepository.update({
      where: { id: repositoryId },
      data: { status: 'syncing', lastError: null },
    });
    emitToUser(repo.userId, 'git:repo_syncing', { repositoryId });

    const result = await syncRepository(repositoryId);

    emitToUser(repo.userId, 'git:repo_synced', {
      repositoryId,
      fullName: fullName || repo.fullName,
      synced: result?.synced || 0,
    });
    logger.info(
      SCOPE,
      `Synced ${result?.synced || 0} commit(s) for ${fullName || repositoryId} (user ${repo.userId})`
    );
  } catch (err) {
    const message = err?.message || 'GitHub sync failed';
    await prisma.gitRepository.update({
      where: { id: repositoryId },
      data: { status: 'error', lastError: message },
    });
    emitToUser(repo.userId, 'git:repo_sync_failed', { repositoryId, message });
    logger.error(SCOPE, `Sync failed for ${repositoryId}: ${message}`);
  }
}

function initGitWorker(io) {
  setSocketIo(io);

  const worker = new Worker('gitQueue', handleGitSyncJob, {
    connection: redis,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    logger.info(SCOPE, `Job ${job?.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(SCOPE, `Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(SCOPE, `Worker error: ${err.message}`);
  });

  logger.info(SCOPE, 'Started');
  gitWorker = worker;
  return worker;
}

function getGitWorker() {
  return gitWorker;
}

module.exports = { initGitWorker, getGitWorker };