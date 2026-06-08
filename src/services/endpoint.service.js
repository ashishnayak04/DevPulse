const prisma = require('../utils/prisma');
const { schedulePing, removePing, reschedulePing } = require('../jobs/scheduler');

/**
 * Create a new monitored endpoint and schedule its ping job.
 */
async function createEndpoint(userId, data) {
  const endpoint = await prisma.endpoint.create({
    data: {
      userId,
      name: data.name,
      url: data.url,
      intervalMs: data.intervalMs || 60000,
    },
  });

  await schedulePing(endpoint);
  return endpoint;
}

/**
 * Get all endpoints for a user.
 */
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

/**
 * Update an endpoint and reschedule if interval changed.
 */
async function updateEndpoint(endpointId, userId, data) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId, isActive: true },
  });

  if (!endpoint) {
    const err = new Error('Endpoint not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const updated = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      name: data.name ?? endpoint.name,
      url: data.url ?? endpoint.url,
      intervalMs: data.intervalMs ?? endpoint.intervalMs,
    },
  });

  // Reschedule if interval or URL changed
  if (data.intervalMs || data.url) {
    await reschedulePing(updated);
  }

  return updated;
}

/**
 * Soft-delete an endpoint and remove its ping job.
 */
async function deleteEndpoint(endpointId, userId) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId, isActive: true },
  });

  if (!endpoint) {
    const err = new Error('Endpoint not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await prisma.endpoint.update({
    where: { id: endpointId },
    data: { isActive: false },
  });

  await removePing(endpointId);
  return { message: 'Endpoint deleted' };
}

/**
 * Get a single endpoint by id (ownership-verified).
 */
async function getEndpoint(endpointId, userId) {
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
    const err = new Error('Endpoint not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
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
