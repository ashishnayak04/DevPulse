const prisma = require('../../lib/prisma');
const redis = require('../../lib/redis');
const constants = require('../../constants');

function buildCacheKey(username) {
  return `status:${username}`;
}

async function invalidateStatusCache(username) {
  await redis.del(buildCacheKey(username));
}

async function getPublicStatus(username) {
  const cacheKey = buildCacheKey(username);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return { data: JSON.parse(cached), cached: true };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!user) {
    return null;
  }

  const endpoints = await prisma.endpoint.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      pingLogs: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
        select: {
          checkedAt: true,
          responseTimeMs: true,
          isUp: true,
          statusCode: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const statusData = {
    username: user.username,
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      name: ep.name,
      url: ep.url,
      status: ep.status,
      lastChecked: ep.pingLogs[0]?.checkedAt || null,
      lastResponseTime: ep.pingLogs[0]?.responseTimeMs || null,
      lastStatusCode: ep.pingLogs[0]?.statusCode || null,
    })),
    generatedAt: new Date().toISOString(),
  };

  await redis.setex(cacheKey, constants.cache.statusPageTtlSeconds, JSON.stringify(statusData));

  return { data: statusData, cached: false };
}

module.exports = { getPublicStatus, invalidateStatusCache };
