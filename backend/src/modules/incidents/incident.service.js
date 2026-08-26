const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');

const incidentSummarySelect = {
  id: true,
  startedAt: true,
  resolvedAt: true,
  durationMs: true,
  acknowledged: true,
  endpoint: { select: { id: true, name: true, url: true } },
  _count: { select: { updates: true } },
};

function ownershipWhere(user) {
  if (user.role === 'ADMIN') {
    return {};
  }
  return { endpoint: { userId: user.id } };
}

function parseListQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, constants.pagination.maxLimit);
  const allowedStatuses = ['open', 'resolved', 'all'];
  const status = allowedStatuses.includes(query.status) ? query.status : 'all';
  return { page, limit, status };
}

function statusWhere(status) {
  if (status === 'open') {
    return { resolvedAt: null };
  }
  if (status === 'resolved') {
    return { resolvedAt: { not: null } };
  }
  return {};
}

function serializeSummary(incident) {
  return {
    id: incident.id,
    endpoint: incident.endpoint,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationMs: incident.durationMs,
    acknowledged: incident.acknowledged,
    status: incident.resolvedAt ? 'resolved' : 'open',
    _count: incident._count,
  };
}

async function assertOwnedIncident(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    select: { id: true },
  });
  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
}

async function listIncidents(user, rawQuery) {
  const { page, limit, status } = parseListQuery(rawQuery);

  const where = { ...ownershipWhere(user), ...statusWhere(status) };

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: incidentSummarySelect,
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    items: incidents.map(serializeSummary),
    total,
    page,
    limit,
  };
}

async function getIncident(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    include: {
      endpoint: { select: { id: true, name: true, url: true } },
      updates: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const { updates, ...rest } = incident;
  return { ...rest, updates, status: incident.resolvedAt ? 'resolved' : 'open' };
}

async function addIncidentUpdate(incidentId, user, data) {
  await assertOwnedIncident(incidentId, user);

  return prisma.incidentUpdate.create({
    data: { incidentId, message: data.message },
    select: { id: true, incidentId: true, message: true, createdAt: true },
  });
}

async function acknowledgeIncident(incidentId, user) {
  await assertOwnedIncident(incidentId, user);

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: { acknowledged: true },
    select: incidentSummarySelect,
  });

  return serializeSummary(incident);
}

module.exports = {
  listIncidents,
  getIncident,
  addIncidentUpdate,
  acknowledgeIncident,
};
