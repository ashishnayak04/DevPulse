const express = require('express');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../utils/prisma');
const router = express.Router();

/**
 * GET /activity/logs?limit=50&offset=0
 * Returns combined ping logs across ALL user endpoints for the activity feed.
 */
router.get('/activity/logs', verifyToken, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const filter = req.query.filter; // 'all', 'failures', 'recoveries'

    // Get user's endpoints
    const endpoints = await prisma.endpoint.findMany({
      where: { userId: req.user.id },
      select: { id: true, name: true, url: true },
    });

    const endpointIds = endpoints.map(ep => ep.id);
    const endpointMap = {};
    endpoints.forEach(ep => { endpointMap[ep.id] = ep; });

    let where = { endpointId: { in: endpointIds } };

    if (filter === 'failures') {
      where.isUp = false;
    }

    const logs = await prisma.pingLog.findMany({
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

    // Get alerts for recoveries filter
    let alerts = [];
    if (filter === 'recoveries' || filter === 'all' || !filter) {
      alerts = await prisma.alert.findMany({
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

    const enrichedLogs = logs.map(log => ({
      ...log,
      endpointName: endpointMap[log.endpointId]?.name || 'Unknown',
      endpointUrl: endpointMap[log.endpointId]?.url || '',
    }));

    const enrichedAlerts = alerts.map(alert => ({
      ...alert,
      endpointName: endpointMap[alert.endpointId]?.name || 'Unknown',
      endpointUrl: endpointMap[alert.endpointId]?.url || '',
    }));

    res.json({
      success: true,
      data: {
        logs: enrichedLogs,
        alerts: enrichedAlerts,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /endpoints/:id/logs?limit=50&offset=0
 * Returns paginated ping logs for an endpoint (authenticated, ownership-verified).
 */
router.get('/:id/logs', verifyToken, async (req, res, next) => {
  try {
    const { id: endpointId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    // Verify ownership
    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, userId: req.user.id },
    });

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
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

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
