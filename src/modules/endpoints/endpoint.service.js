const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const { schedulePing, removePing, reschedulePing } = require('../../queues/ping.queue');
const constants = require('../../constants');

async function createEndpoint(userId, data) {
  const endpoint = await prisma.endpoint.create({
    data: {
      userId,
      name: data.name,
      url: data.url,
      intervalMs: data.intervalMs || constants.monitoring.defaultIntervalMs,
    },
  });

  await schedulePing(endpoint);
  return endpoint;
}

async function getUserEndpoints(userId) {
  return prisma.endpoint.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      pingLogs: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
      },
    },
  });
}

async function getEndpoint(endpointId, userId) {
  const endpoint = await findOwnedEndpoint(endpointId, userId);
  return endpoint;
}

async function updateEndpoint(endpointId, userId, data) {
  await findOwnedEndpoint(endpointId, userId);

  const updated = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      name: data.name,
      url: data.url,
      intervalMs: data.intervalMs,
    },
  });

  if (data.intervalMs || data.url) {
    await reschedulePing(updated);
  }

  return updated;
}

async function deleteEndpoint(endpointId, userId) {
  await findOwnedEndpoint(endpointId, userId);

  await prisma.endpoint.update({
    where: { id: endpointId },
    data: { isActive: false },
  });

  await removePing(endpointId);
  return { message: 'Endpoint deleted' };
}

async function findOwnedEndpoint(endpointId, userId) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId, isActive: true },
    include: {
      pingLogs: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!endpoint) {
    throw new HttpError('Endpoint not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  return endpoint;
}

module.exports = {
  createEndpoint,
  getUserEndpoints,
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
};
