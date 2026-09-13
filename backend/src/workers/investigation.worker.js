const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { trackWorker } = require('../lib/queue-metrics');
const { investigationQueue } = require('../queues/investigation.queue');
const {
  aiConfigured,
  checkAiHealth,
  runInvestigation,
  InvestigationBudgetError,
} = require('../services/ai.service');
const { aiResultSchema } = require('../schemas/ai-result.schema');
const { ZodError } = require('zod');

const SCOPE = 'InvestigationWorker';

let investigationWorker = null;
let socketIo = null;

async function findOrCreateInvestigation({ incidentId, endpointId, userId }) {
  if (incidentId) {
    const existing = await prisma.investigation.findUnique({ where: { incidentId } });
    if (existing) return existing;

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    if (!incident) return null;

    return prisma.investigation.create({ data: { incidentId } });
  }

  if (!endpointId) return null;

  const openIncident = await prisma.incident.findFirst({
    where: { endpointId, resolvedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  if (!openIncident) return null;

  return prisma.investigation.upsert({
    where: { incidentId: openIncident.id },
    update: {},
    create: { incidentId: openIncident.id },
  });
}

async function setStatus(investigation, data) {
  return prisma.investigation.update({
    where: { id: investigation.id },
    data,
  });
}

function emitSocket(userId, event, payload) {
  if (socketIo && userId) {
    socketIo.to(`user:${userId}`).emit(event, payload);
  }
}

async function failInvestigation(investigation, message, userId) {
  await setStatus(investigation, { status: 'FAILED', error: message, completedAt: new Date() });
  logger.error(SCOPE, `Investigation ${investigation.id} failed — ${message}`);
  emitSocket(userId, 'investigation:failed', {
    id: investigation.id,
    incidentId: investigation.incidentId,
    status: 'FAILED',
    error: message,
  });
}

async function persistInvestigationResult(investigation, result) {
  await prisma.$transaction(async (tx) => {
    await tx.investigation.update({
      where: { id: investigation.id },
      data: {
        status: 'COMPLETED',
        summary: result.summary,
        rootCause: result.rootCause,
        confidence: result.confidence,
        affectedServices: result.affectedServices.length ? result.affectedServices : null,
        relatedDeploymentId: result.relatedDeployment ?? null,
        relatedCommitId: result.relatedCommit ?? null,
        changedFiles: result.changedFiles.length ? result.changedFiles : null,
        suggestedFix: result.suggestedFix ?? null,
        risk: result.risk ?? null,
        verificationPlan: result.verificationPlan ?? null,
        error: null,
        completedAt: new Date(),
      },
    });

    // A re-run replaces the previous report (evidence + tool audit).
    await tx.investigationEvidence.deleteMany({ where: { investigationId: investigation.id } });
    await tx.investigationToolCall.deleteMany({ where: { investigationId: investigation.id } });

    if (result.evidence.length > 0) {
      await tx.investigationEvidence.createMany({
        data: result.evidence.map((e) => ({
          investigationId: investigation.id,
          sourceType: e.sourceType,
          sourceKey: e.sourceKey,
          title: e.title,
          detail: e.detail ?? null,
          classification: e.classification,
          sourceUrl: e.sourceUrl ?? null,
          payload: e.payload ?? null,
        })),
      });
    }

    if (result.toolCalls.length > 0) {
      await tx.investigationToolCall.createMany({
        data: result.toolCalls.map((t) => ({
          investigationId: investigation.id,
          toolName: t.toolName,
          arguments: t.arguments ?? {},
          result: t.result ?? null,
          status: t.status ?? 'success',
          durationMs: t.durationMs ?? null,
        })),
      });
    }
  });
}

async function handleInvestigationJob(job) {
  const { incidentId, endpointId, userId } = job.data || {};

  const investigation = await findOrCreateInvestigation({ incidentId, endpointId, userId });
  if (!investigation) {
    logger.warn(SCOPE, `No incident or investigation found for job ${job.id}, skipping`);
    return;
  }

  await setStatus(investigation, { status: 'RUNNING', startedAt: new Date(), error: null });
  logger.info(SCOPE, `Investigation ${investigation.id} started (incident ${investigation.incidentId})`);
  emitSocket(userId, 'investigation:started', {
    id: investigation.id,
    incidentId: investigation.incidentId,
    status: 'RUNNING',
  });

  if (!aiConfigured()) {
    const message = 'AI service not configured (AI_SERVICE_URL / AI_SERVICE_TOKEN required)';
    await failInvestigation(investigation, message, userId);
    return;
  }

  const health = await checkAiHealth();
  if (!health.available) {
    const message = `AI service unreachable: ${health.reason || 'unknown error'}`;
    await failInvestigation(investigation, message, userId);
    return;
  }

  try {
    const raw = await runInvestigation({ incidentId, endpointId });
    const result = aiResultSchema.parse(raw);
    await persistInvestigationResult(investigation, result);
    logger.info(SCOPE, `Investigation ${investigation.id} completed in ${result.toolCalls.length} tool calls`);
    emitSocket(userId, 'investigation:completed', {
      id: investigation.id,
      incidentId: investigation.incidentId,
      status: 'COMPLETED',
      summary: result.summary,
      rootCause: result.rootCause,
      confidence: result.confidence,
      risk: result.risk,
    });
  } catch (err) {
    if (err instanceof InvestigationBudgetError) {
      const message = `Investigation halted: ${err.message}`;
      await failInvestigation(investigation, message, userId);
      return;
    }
    if (err instanceof ZodError) {
      const message = `AI service returned a malformed investigation: ${err.errors
        .slice(0, 3)
        .map((e) => e.message)
        .join('; ')}`;
      await failInvestigation(investigation, message, userId);
      return;
    }
    await failInvestigation(investigation, err.message || 'Unknown investigation error', userId);
  }
}

function initInvestigationWorker(io) {
  socketIo = io || null;

  const worker = new Worker('investigationQueue', handleInvestigationJob, {
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
  investigationWorker = trackWorker({ name: 'investigationQueue', queue: investigationQueue, worker });
  return worker;
}

function getInvestigationWorker() {
  return investigationWorker;
}

module.exports = { initInvestigationWorker, getInvestigationWorker };