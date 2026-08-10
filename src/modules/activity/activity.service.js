const prisma = require('../../lib/prisma');
const constants = require('../../constants');

function parsePagination(query) {
  const limit = Math.min(parseInt(query.limit, 10) || constants.pagination.defaultLimit, constants.pagination.maxLimit);
  const offset = parseInt(query.offset, 10) || 0;
  return { limit, offset };
}

async function getActivityFeed(userId, { limit, offset, filter }) {
  const endpoints = await prisma.endpoint.findMany({
    where: { userId },
    select: { id: true, name: true, url: true },
  });

  const endpointIds = endpoints.map((ep) => ep.id);
  const endpointMap = new Map(endpoints.map((ep) => [ep.id, ep]));

  const logs = await getFilteredLogs(endpointIds, { limit, offset, filter });
  const alerts = await getFilteredAlerts(endpointIds, { limit, filter });

  return {
    logs: logs.map(enrichLog),
    alerts: alerts.map(enrichLog),
  };

  function enrichLog(log) {
    const endpoint = endpointMap.get(log.endpointId);
    return {
      ...log,
      endpointName: endpoint?.name || 'Unknown',
      endpointUrl: endpoint?.url || '',
    };
  }
}

async function getFilteredLogs(endpointIds, { limit, offset, filter }) {
  const where = { endpointId: { in: endpointIds } };
  if (filter === 'failures') {
    where.isUp = false;
  }

  return prisma.pingLog.findMany({
    where,
    orderBy: { checkedAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      endpointId: true,
      statusCode: true,
      responseTimeMs: true,
      isUp: true,
      checkedAt: true,
    },
  });
}

async function getFilteredAlerts(endpointIds, { limit, filter }) {
  if (filter === 'failures') {
    return [];
  }

  return prisma.alert.findMany({
    where: { endpointId: { in: endpointIds } },
    orderBy: { sentAt: 'desc' },
    take: limit,
    select: {
      id: true,
      endpointId: true,
      type: true,
      sentAt: true,
    },
  });
}

async function getEndpointLogs(endpointId, userId, { limit, offset }) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId },
  });

  if (!endpoint) {
    return null;
  }

  const [logs, total] = await Promise.all([
    prisma.pingLog.findMany({
      where: { endpointId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        statusCode: true,
        responseTimeMs: true,
        isUp: true,
        checkedAt: true,
      },
    }),
    prisma.pingLog.count({ where: { endpointId } }),
  ]);

  return { logs, total, limit, offset };
}

module.exports = { getActivityFeed, getEndpointLogs, parsePagination };
