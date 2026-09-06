const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const config = require('../config/env');

const SCOPE = 'VerificationWorker';

let verificationWorker = null;
let socketIo = null;

function emitSocket(userId, event, payload) {
  if (socketIo && userId) {
    socketIo.to(`user:${userId}`).emit(event, payload);
  }
}

function p95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

async function sampleMetrics(endpointId, start, end) {
  const logs = await prisma.pingLog.findMany({
    where: { endpointId, checkedAt: { gte: start, lte: end } },
    orderBy: { checkedAt: 'asc' },
    take: config.verification.maxSamples,
  });

  const down = logs.filter((l) => !l.isUp).length;
  const timings = logs
    .filter((l) => typeof l.responseTimeMs === 'number' && Number.isFinite(l.responseTimeMs))
    .map((l) => l.responseTimeMs);
  const avgLatency = timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : null;

  return {
    total: logs.length,
    down,
    up: logs.length - down,
    truncated: logs.length === config.verification.maxSamples,
    errorRate: logs.length > 0 ? Number((down / logs.length).toFixed(4)) : null,
    uptime: logs.length > 0 ? Number(((logs.length - down) / logs.length).toFixed(4)) : null,
    avgLatency: avgLatency === null ? null : Math.round(avgLatency * 10) / 10,
    p95Latency: p95(timings),
  };
}

function decideResult(pre, post, recurrence) {
  const preRate = pre.total > 0 ? pre.down / pre.total : 0;
  const postRate = post.total > 0 ? post.down / post.total : 0;

  if (pre.total === 0) {
    return { status: 'INCONCLUSIVE', reason: 'No pre-deployment samples to compare against' };
  }
  if (post.total === 0) {
    return { status: 'INCONCLUSIVE', reason: 'No post-deployment samples in the verification window' };
  }
  if (recurrence > 0) {
    return { status: 'FAILED', reason: `Incident recurred ${recurrence} time(s) after the fix deployment` };
  }

  const dropRatio = preRate > 0 ? (preRate - postRate) / preRate : postRate > 0 ? -1 : 1;

  if (postRate === 0 || postRate <= preRate * config.verification.failureDropRatio) {
    return {
      status: 'PASS',
      reason:
        postRate === 0
          ? 'Failure rate dropped to zero after the fix'
          : `Failure rate dropped ${Math.round(dropRatio * 100)}% after the fix`,
    };
  }
  if (postRate >= preRate) {
    return { status: 'FAILED', reason: 'Failure rate did not improve after the fix deployment' };
  }
  return { status: 'INCONCLUSIVE', reason: 'Improvement is partial; below the PASS threshold' };
}

async function handleVerificationJob(job) {
  const { incidentId, endpointId, fixSuggestionId, userId } = job.data || {};

  const verification = await prisma.fixVerification.findFirst({
    where: { incidentId },
    orderBy: { createdAt: 'desc' },
  });
  if (!verification) {
    logger.warn(SCOPE, `No verification for incident ${incidentId}, skipping job ${job.id}`);
    return;
  }

  await prisma.fixVerification.update({
    where: { id: verification.id },
    data: { status: 'RUNNING', startedAt: new Date(), error: null },
  });
  logger.info(SCOPE, `Verification ${verification.id} started (incident ${incidentId})`);
  emitSocket(userId, 'verification:started', { id: verification.id, incidentId, status: 'RUNNING' });

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, startedAt: true, endpointId: true, endpoint: { select: { userId: true } } },
  });
  if (!incident) {
    await prisma.fixVerification.update({
      where: { id: verification.id },
      data: {
        status: 'INCONCLUSIVE',
        error: 'Incident not found',
        evidence: { phase: 'fix-verification', reason: 'Incident not found' },
        completedAt: new Date(),
      },
    });
    return;
  }

  try {
    const deployment = await prisma.deployment.findFirst({
      where: { userId: incident.endpoint.userId, deployedAt: { gte: incident.startedAt } },
      orderBy: { deployedAt: 'desc' },
      select: { id: true, environment: true, commitSha: true, deployedAt: true, status: true },
    });

    if (!deployment) {
      const message = 'No deployment found after the incident started (nothing deployed since the investigation)';
      await prisma.fixVerification.update({
        where: { id: verification.id },
        data: {
          status: 'INCONCLUSIVE',
          error: message,
          evidence: { phase: 'fix-verification', reason: message },
          completedAt: new Date(),
        },
      });
      emitSocket(userId, 'verification:completed', { id: verification.id, incidentId, status: 'INCONCLUSIVE', error: message });
      return;
    }

    const deployAt = new Date(deployment.deployedAt).getTime();
    const windowMs = config.verification.sampleMinutes * 60 * 1000;
    const preStart = new Date(new Date(incident.startedAt).getTime() - windowMs);
    const pre = await sampleMetrics(incident.endpointId, preStart, new Date(deployAt));
    const post = await sampleMetrics(incident.endpointId, new Date(deployAt), new Date(deployAt + windowMs));

    const recurrence = await prisma.incident.count({
      where: { endpointId: incident.endpointId, startedAt: { gte: new Date(deployAt) } },
    });

    const { status, reason } = decideResult(pre, post, recurrence);
    const evidence = {
      phase: 'fix-verification',
      deployment: {
        id: deployment.id,
        environment: deployment.environment,
        commitSha: deployment.commitSha,
        deployedAt: deployment.deployedAt,
        status: deployment.status,
      },
      recurrence,
      reason,
      comparison: {
        errorRatePre: pre.errorRate,
        errorRatePost: post.errorRate,
        upPre: pre.up,
        upPost: post.up,
      },
    };

    await prisma.fixVerification.update({
      where: { id: verification.id },
      data: {
        status,
        deploymentId: deployment.id,
        fixSuggestionId: fixSuggestionId || verification.fixSuggestionId,
        preMetrics: pre,
        postMetrics: post,
        evidence,
        error: null,
        completedAt: new Date(),
      },
    });

    logger.info(SCOPE, `Verification ${verification.id} -> ${status} (${reason})`);
    emitSocket(userId, 'verification:completed', {
      id: verification.id,
      incidentId,
      status,
      deploymentId: deployment.id,
      reason,
    });
  } catch (err) {
    await prisma.fixVerification.update({
      where: { id: verification.id },
      data: { status: 'FAILED', error: err.message || 'Unknown verification error', completedAt: new Date() },
    });
    logger.error(SCOPE, `Verification ${verification.id} failed — ${err.message}`);
    emitSocket(userId, 'verification:failed', {
      id: verification.id,
      incidentId,
      status: 'FAILED',
      error: err.message,
    });
  }
}

function initVerificationWorker(io) {
  socketIo = io || null;

  const worker = new Worker('verificationQueue', handleVerificationJob, {
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
  verificationWorker = worker;
  return worker;
}

function getVerificationWorker() {
  return verificationWorker;
}

module.exports = { initVerificationWorker, getVerificationWorker };