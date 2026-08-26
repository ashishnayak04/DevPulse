const prisma = require('../../lib/prisma');
const redis = require('../../lib/redis');
const HttpError = require('../../lib/http-error');
const { pingQueue } = require('../../queues/ping.queue');
const { alertQueue } = require('../../queues/alert.queue');
const { recordAudit } = require('../../lib/audit');
const { setMonitoringEnabled, getPlatformSettings } = require('../../lib/platform-settings');
const { removeAllPings, scheduleAllActive } = require('../../queues/ping.queue');

const SETTING_ID = 'global';

async function getOverview() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
    planGroups,
    recentSignups,
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
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
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

  const planDistribution = { FREE: 0, PRO: 0, BUSINESS: 0 };
  for (const group of planGroups) {
    if (group.plan in planDistribution) {
      planDistribution[group.plan] = group._count._all;
    }
  }

  const system = await getSystemHealth();
  const platform = await getPlatformSettings();

  return {
    system,
    platform: { monitoringEnabled: platform.monitoringEnabled, message: platform.message },
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
    planDistribution,
    recentSignups,
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

async function listUsers(query = {}) {
  const { search, plan, role, status, sort, page, limit } = query;

  const where = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(plan && { plan }),
    ...(role && { role }),
    ...(status === 'active' && { isActive: true }),
    ...(status === 'disabled' && { isActive: false }),
  };

  const orderBy =
    sort === 'endpointCount'
      ? [{ endpoints: { _count: 'desc' } }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        plan: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        _count: { select: { endpoints: true, webhookConfigs: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const items = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    endpointCount: user._count.endpoints,
    webhookCount: user._count.webhookConfigs,
  }));

  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getUserDetail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      plan: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
      _count: { select: { endpoints: true, webhookConfigs: true } },
    },
  });

  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const [endpoints, recentAlerts, totalChecks, openIncidents] = await Promise.all([
    prisma.endpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        isActive: true,
        intervalMs: true,
        createdAt: true,
      },
    }),
    prisma.alert.findMany({
      where: { endpoint: { userId } },
      orderBy: { sentAt: 'desc' },
      take: 15,
      select: {
        id: true,
        type: true,
        sentAt: true,
        endpoint: { select: { name: true } },
      },
    }),
    prisma.pingLog.count({ where: { endpoint: { userId } } }),
    prisma.incident.count({ where: { resolvedAt: null, endpoint: { userId } } }),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    counts: {
      endpoints: user._count.endpoints,
      webhooks: user._count.webhookConfigs,
    },
    endpoints,
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      sentAt: alert.sentAt,
      endpointName: alert.endpoint?.name || 'Unknown endpoint',
    })),
    stats: { totalChecks, openIncidents },
  };
}

async function updateUser(actor, userId, data) {
  const actorId = actor.id;
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

  // Downgrading a plan that would exceed the new plan's endpoint cap: existing
  // endpoints stay but new ones are blocked until usage drops under the cap.
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.role && { role: data.role }),
      ...(typeof data.isActive === 'boolean' && { isActive: data.isActive }),
      ...(data.plan && { plan: data.plan }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      plan: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
      _count: { select: { endpoints: true, webhookConfigs: true } },
    },
  });

  await recordAudit({
    actorId,
    actorEmail: actor.email,
    action: data.plan && !data.role && typeof data.isActive !== 'boolean'
      ? 'user.plan_change'
      : 'user.update',
    targetType: 'user',
    targetId: userId,
    metadata: {
      role: data.role,
      plan: data.plan,
      isActive: typeof data.isActive === 'boolean' ? data.isActive : undefined,
    },
  });

  return updatedUser;
}

async function deleteUser(actor, userId) {
  const actorId = actor.id;
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

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'user.delete',
    targetType: 'user',
    targetId: userId,
    metadata: { username: user.username, email: user.email },
  });

  return { deleted: true, userId };
}

async function toggleMonitoring(actor, { enabled, message = null }) {
  const setting = await setMonitoringEnabled(enabled, message);

  if (enabled) {
    await scheduleAllActive(prisma);
  } else {
    await removeAllPings();
  }

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: enabled ? 'platform.monitoring_enabled' : 'platform.monitoring_disabled',
    targetType: 'platform',
    targetId: 'monitoring',
    metadata: { message },
  });

  return { monitoringEnabled: setting.monitoringEnabled, message: setting.message };
}

async function setAnnouncement(actor, { message, type }) {
  const setting = await prisma.platformSetting.upsert({
    where: { id: SETTING_ID },
    update: { announcementMessage: message, announcementType: type },
    create: { id: SETTING_ID, announcementMessage: message, announcementType: type },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'announcement.create',
    targetType: 'platform',
    targetId: 'announcement',
    metadata: { type, length: message.length },
  });

  return {
    announcement: { message: setting.announcementMessage, type: setting.announcementType || 'info' },
  };
}

async function clearAnnouncement(actor) {
  await prisma.platformSetting.upsert({
    where: { id: SETTING_ID },
    update: { announcementMessage: null, announcementType: null },
    create: { id: SETTING_ID, announcementMessage: null, announcementType: null },
  });

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'announcement.clear',
    targetType: 'platform',
    targetId: 'announcement',
    metadata: {},
  });

  return { cleared: true };
}

async function listAuditLogs({ limit }) {
  const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });
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

module.exports = {
  getOverview,
  listUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  listEndpoints,
  getPlatformActivity,
  toggleMonitoring,
  setAnnouncement,
  clearAnnouncement,
  listAuditLogs,
};
