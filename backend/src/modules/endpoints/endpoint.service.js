const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const { schedulePing, removePing, reschedulePing } = require('../../queues/ping.queue');
const constants = require('../../constants');
const logger = require('../../lib/logger');

function getPlanLimits(plan) {
  return constants.plans[plan] || constants.plans.FREE;
}

async function assertPlanAllowsEndpoint(user, requestedIntervalMs) {
  const limits = getPlanLimits(user.plan);

  const activeCount = await prisma.endpoint.count({ where: { userId: user.id, isActive: true } });
  if (activeCount >= limits.maxEndpoints) {
    throw new HttpError(
      `Your ${user.plan} plan allows up to ${limits.maxEndpoints} monitors. Upgrade your plan to add more.`,
      { statusCode: 403, code: 'PLAN_LIMIT_REACHED' }
    );
  }

  if (requestedIntervalMs && requestedIntervalMs < limits.minIntervalMs) {
    throw new HttpError(
      `Your ${user.plan} plan supports checks every ${limits.minIntervalMs / 1000}s or slower. Upgrade for faster checks.`,
      { statusCode: 403, code: 'PLAN_LIMIT_REACHED' }
    );
  }
}

const ADVANCED_FIELDS = ['method', 'headers', 'body', 'expectedStatusCodes', 'keywordMatch', 'sslCheck', 'sslExpiryDays'];

function pickAdvancedFields(data) {
  const out = {};
  for (const field of ADVANCED_FIELDS) {
    if (data[field] !== undefined) {
      out[field] = data[field];
    }
  }
  if (out.headers && Object.keys(out.headers).length === 0) {
    out.headers = null;
  }
  if (out.body !== undefined) {
    out.body = out.body || null;
  }
  if (out.keywordMatch !== undefined) {
    out.keywordMatch = out.keywordMatch || null;
  }
  return out;
}

async function createEndpoint(userId, data) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  await assertPlanAllowsEndpoint(user, data.intervalMs);

  const endpoint = await prisma.endpoint.create({
    data: {
      userId,
      name: data.name,
      url: data.url,
      intervalMs: Math.max(data.intervalMs || constants.monitoring.defaultIntervalMs, getPlanLimits(user.plan).minIntervalMs),
      ...pickAdvancedFields(data),
    },
  });

  try {
    await schedulePing(endpoint);
  } catch (err) {
    logger.warn('EndpointService', `Failed to schedule ping for ${endpoint.name}: ${err.message}`);
  }

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

  if (data.intervalMs) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const limits = getPlanLimits(user?.plan);
    if (data.intervalMs < limits.minIntervalMs) {
      throw new HttpError(
        `Your ${user?.plan || 'FREE'} plan supports checks every ${limits.minIntervalMs / 1000}s or slower. Upgrade for faster checks.`,
        { statusCode: 403, code: 'PLAN_LIMIT_REACHED' }
      );
    }
  }

  const updated = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      name: data.name,
      url: data.url,
      intervalMs: data.intervalMs,
      ...pickAdvancedFields(data),
    },
  });

  if (data.intervalMs || data.url) {
    await reschedulePing(updated);
  }

  return updated;
}

async function getUsage(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const limits = getPlanLimits(user.plan);
  const [endpointCount, webhookCount] = await Promise.all([
    prisma.endpoint.count({ where: { userId, isActive: true } }),
    prisma.webhookConfig.count({ where: { userId } }),
  ]);

  return {
    plan: user.plan,
    emailVerified: user.emailVerified,
    limits,
    usage: { endpoints: endpointCount, webhooks: webhookCount },
  };
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
  getUsage,
};
