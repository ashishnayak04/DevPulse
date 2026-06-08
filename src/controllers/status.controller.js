const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const CACHE_TTL = 30; // seconds

/**
 * GET /status/:username — public status page.
 * Cache-aside pattern: check Redis → miss → query DB → cache → return.
 * Cache invalidated by ping worker after each result write.
 */
async function getPublicStatus(req, res, next) {
  try {
    const { username } = req.params;
    const cacheKey = `status:${username}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Get all active endpoints with last ping
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

    // Cache in Redis for 30s
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(statusData));

    res.json({
      success: true,
      data: statusData,
      cached: false,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicStatus };
