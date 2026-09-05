const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { aiConfigured, checkAiHealth } = require('../services/ai.service');

const SCOPE = 'InvestigationWorker';

let investigationWorker = null;

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

async function failInvestigation(investigation, message) {
  await prisma.investigation.update({
    where: { id: investigation.id },
    data: { status: 'FAILED', error: message, completedAt: new Date() },
  });
}

async function handleInvestigationJob(job) {
  const { incidentId, endpointId, userId } = job.data || {};

  const investigation = await findOrCreateInvestigation({ incidentId, endpointId, userId });
  if (!investigation) {
    logger.warn(SCOPE, `No incident or investigation found for job ${job.id}, skipping`);
    return;
  }

  await prisma.investigation.update({
    where: { id: investigation.id },
    data: { status: 'RUNNING', startedAt: new Date(), error: null },
  });
  logger.info(SCOPE, `Investigation ${investigation.id} started (incident ${investigation.incidentId})`);

  if (!aiConfigured()) {
    const message = 'AI service not configured (AI_SERVICE_URL / AI_SERVICE_TOKEN required)';
    logger.error(SCOPE, message);
    await failInvestigation(investigation, message);
    return;
  }

  const health = await checkAiHealth();
  if (!health.available) {
    const message = `AI service unreachable: ${health.reason || 'unknown error'}`;
    logger.error(SCOPE, `Investigation ${investigation.id} failed — ${message}`);
    await failInvestigation(investigation, message);
    return;
  }

  const message = 'AI investigation engine not implemented yet (DevPulse 2.0 Phase 4)';
  logger.warn(SCOPE, `Investigation ${investigation.id} reached AI service but ${message}`);
  await failInvestigation(investigation, message);
}

function initInvestigationWorker() {
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
  investigationWorker = worker;
  return worker;
}

function getInvestigationWorker() {
  return investigationWorker;
}

module.exports = { initInvestigationWorker, getInvestigationWorker };