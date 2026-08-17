const prisma = require('../../lib/prisma');
const redis = require('../../lib/redis');
const HttpError = require('../../lib/http-error');
const { pingQueue } = require('../../queues/ping.queue');
const { alertQueue } = require('../../queues/alert.queue');

async function getOverview() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totals] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "totalChecks",
      COUNT(*) FILTER (WHERE "isUp" = false)::int AS "totalFailures",
      COALESCE(AVG("responseTimeMs"), 0)::float AS "avgResponseTime"
    FROM "PingLog"
    WHERE "checkedAt" > ${twentyFourHoursAgo}
  `;

  const [p95Result] = await prisma.$queryRaw`
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "responseTimeMs") AS p95
    FROM "PingLog"
    WHERE "checkedAt" > NOW() - INTERVAL '24 hours'
  `;

  const [
    totalUsers,
    adminUsers,
    disabledUsers,
    activeUsers,
    totalEndpoints,
    activeEndpoints,
    upEndpoints,
    downEndpoints,
    alerts24h,
    recentAlerts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.endpoint.count(),
    prisma.endpoint.count({ where: { isActive: true } }),
    prisma.endpoint.count({ where: { status: 'UP' } }),
    prisma.endpoint.count({ where: { status: 'DOWN' } }),
    prisma.alert.count({ where: { sentAt: { gt: twentyFourHoursAgo } } }),
    prisma.alert.findMany({
      orderBy: { sentAt: 'desc' },
      take: 6,
      select: {
        id: true,
        type: true,
        sentAt: true,
        endpoint: { select: { name: true, user: { select: { username: true } } } },
      },
    }),
  ]);

  const system = await getSystemHealth();

  return {
    system,
    stats: {
      users: { total: totalUsers, active: activeUsers, disabled: disabledUsers, admins: adminUsers },
      endpoints: { total: totalEndpoints, active: activeEndpoints, up: upEndpoints, down: downEndpoints },
      checks24h: totals?.totalChecks || 0,
      failures24h: totals?.totalFailures || 0,
      avgResponseTime24h: Math.round((totals?.avgResponseTime || 0) * 100) / 100,
      p95Latency24h: Math.round((p95Result?.p95 || 0) * 100) / 100,
      alerts24h,
    },
    recentAlerts,
  };
}

async function getSystemHealth() {
  const results = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1 AS ok`,
    redis.ping(),
    pingQueue.getJobCounts(),
    alertQueue.getJobCounts(),
  ]);

  return {
    database: results[0].status === 'fulfilled' ? 'up' : 'down',
    redis: results[1].status === 'fulfilled' && results[1].value === 'PONG' ? 'up' : 'down',
    queues: {
      ping: results[2].status === 'fulfilled' ? results[2].value : {},
      alert: results[3].status === 'fulfilled' ? results[3].value : {},
    },
  };
}

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { endpoints: true, webhookConfigs: true } },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    endpointCount: user._count.endpoints,
    webhookCount: user._count.webhookConfigs,
  }));
}

async function updateUser(actorId, userId, data) {
  if (actorId === userId) {
    throw new HttpError('You cannot modify your own account from the admin panel', {
      statusCode: 400,
      code: 'SELF_MODIFICATION',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const finalRole = data.role || user.role;
  const finalActive = typeof data.isActive === 'boolean' ? data.isActive : user.isActive;

  if (user.role === 'ADMIN' && !(finalRole === 'ADMIN' && finalActive)) {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (adminCount <= 1) {
      throw new HttpError('Cannot demote or disable the last active admin', {
        statusCode: 400,
        code: 'LAST_ADMIN',
      });
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.role && { role: data.role }),
      ...(typeof data.isActive === 'boolean' && { isActive: data.isActive }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { endpoints: true, webhookConfigs: true } },
    },
  });
}

async function deleteUser(actorId, userId) {
  if (actorId === userId) {
    throw new HttpError('You cannot delete your own account', {
      statusCode: 400,
      code: 'SELF_DELETION',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (adminCount <= 1) {
      throw new HttpError('Cannot delete the last active admin', {
        statusCode: 400,
        code: 'LAST_ADMIN',
      });
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  return { deleted: true, userId };
}

async function listEndpoints() {
  return prisma.endpoint.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      isActive: true,
      intervalMs: true,
      createdAt: true,
      user: { select: { username: true, email: true } },
      pingLogs: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
        select: { checkedAt: true, responseTimeMs: true, isUp: true, statusCode: true },
      },
    },
  });
}

async function getPlatformActivity({ limit }) {
  const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);

  const [logs, alerts] = await Promise.all([
    prisma.pingLog.findMany({
      orderBy: { checkedAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        endpointId: true,
        statusCode: true,
        responseTimeMs: true,
        isUp: true,
        checkedAt: true,
        endpoint: { select: { name: true, user: { select: { username: true } } } },
      },
    }),
    prisma.alert.findMany({
      orderBy: { sentAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        endpointId: true,
        type: true,
        sentAt: true,
        endpoint: { select: { name: true, user: { select: { username: true } } } },
      },
    }),
  ]);

  return { logs, alerts };
}

module.exports = { getOverview, listUsers, updateUser, deleteUser, listEndpoints, getPlatformActivity };
