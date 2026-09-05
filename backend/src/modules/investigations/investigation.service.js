const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const { enqueueInvestigation } = require('../../queues/investigation.queue');
const logger = require('../../lib/logger');

const investigationSummarySelect = {
  id: true,
  incidentId: true,
  status: true,
  summary: true,
  rootCause: true,
  confidence: true,
  error: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  incident: {
    select: {
      id: true,
      startedAt: true,
      resolvedAt: true,
      acknowledged: true,
      endpoint: { select: { id: true, name: true, url: true } },
    },
  },
};

function ownershipWhere(user) {
  if (user.role === 'ADMIN') {
    return {};
  }
  return { incident: { endpoint: { userId: user.id } } };
}

function parseListQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, constants.pagination.maxLimit);
  const allowedStatuses = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'];
  const status = allowedStatuses.includes(query.status) ? query.status : null;
  return { page, limit, status };
}

async function assertOwnedInvestigation(investigationId, user) {
  const investigation = await prisma.investigation.findFirst({
    where: { id: investigationId, ...ownershipWhere(user) },
    select: { id: true },
  });
  if (!investigation) {
    throw new HttpError('Investigation not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
}

async function listInvestigations(user, rawQuery) {
  const { page, limit, status } = parseListQuery(rawQuery);
  const where = { ...ownershipWhere(user), ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.investigation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: investigationSummarySelect,
    }),
    prisma.investigation.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function getInvestigation(investigationId, user) {
  const investigation = await prisma.investigation.findFirst({
    where: { id: investigationId, ...ownershipWhere(user) },
    include: {
      incident: {
        select: {
          id: true,
          startedAt: true,
          resolvedAt: true,
          durationMs: true,
          acknowledged: true,
          endpoint: { select: { id: true, name: true, url: true } },
        },
      },
      evidence: { orderBy: { createdAt: 'asc' } },
      toolCalls: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!investigation) {
    throw new HttpError('Investigation not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  return investigation;
}

async function assertOwnedIncident(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...(user.role === 'ADMIN' ? {} : { endpoint: { userId: user.id } }) },
    select: { id: true, endpointId: true },
  });
  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return incident;
}

async function triggerInvestigation(user, { incidentId }) {
  const incident = await assertOwnedIncident(incidentId, user);

  const existing = await prisma.investigation.findUnique({ where: { incidentId } });
  if (existing && (existing.status === 'QUEUED' || existing.status === 'RUNNING')) {
    throw new HttpError('An investigation for this incident is already in progress', {
      statusCode: 409,
      code: 'INVESTIGATION_IN_PROGRESS',
    });
  }

  const investigation =
    existing ??
    (await prisma.investigation.create({ data: { incidentId } }));

  await enqueueInvestigation({
    incidentId,
    endpointId: incident.endpointId,
    userId: user.id,
  });

  return prisma.investigation.findUnique({
    where: { id: investigation.id },
    select: investigationSummarySelect,
  });
}

async function rerunInvestigation(investigationId, user) {
  await assertOwnedInvestigation(investigationId, user);

  const investigation = await prisma.investigation.findUnique({
    where: { id: investigationId },
    select: { id: true, incidentId: true, status: true },
  });

  if (!investigation) {
    throw new HttpError('Investigation not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (investigation.status === 'QUEUED' || investigation.status === 'RUNNING') {
    throw new HttpError('An investigation for this incident is already in progress', {
      statusCode: 409,
      code: 'INVESTIGATION_IN_PROGRESS',
    });
  }

  const incident = await prisma.incident.findUnique({
    where: { id: investigation.incidentId },
    select: { endpointId: true },
  });

  await prisma.investigation.update({
    where: { id: investigationId },
    data: { status: 'QUEUED', error: null, startedAt: null, completedAt: null },
  });

  await enqueueInvestigation({
    incidentId: investigation.incidentId,
    endpointId: incident?.endpointId,
    userId: user.id,
  });

  logger.info('Investigations', `Investigation ${investigationId} re-queued`);

  return prisma.investigation.findUnique({
    where: { id: investigationId },
    select: investigationSummarySelect,
  });
}

module.exports = {
  listInvestigations,
  getInvestigation,
  triggerInvestigation,
  rerunInvestigation,
};