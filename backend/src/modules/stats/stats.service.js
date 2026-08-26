const prisma = require('../../lib/prisma');

const WINDOW_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

function getSince(window) {
  return new Date(Date.now() - WINDOW_MS[window]);
}

async function getEndpointStats(endpointId, userId, window = '24h') {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId },
  });

  if (!endpoint) {
    return null;
  }

  const since = getSince(window);

  const [totals] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "totalChecks",
      COUNT(*) FILTER (WHERE "isUp" = false)::int AS "totalFailures",
      COUNT(*) FILTER (WHERE "isUp" = true)::int AS "totalSuccess",
      COALESCE(AVG("responseTimeMs"), 0)::float AS "avgResponseTime"
    FROM "PingLog"
    WHERE "endpointId" = ${endpointId}
      AND "checkedAt" > ${since}
  `;

  const [p95Result] = await prisma.$queryRaw`
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "responseTimeMs") AS p95
    FROM "PingLog"
    WHERE "endpointId" = ${endpointId}
      AND "checkedAt" >= ${since}
  `;

  const bucket = window === '24h' ? 'hour' : 'day';

  const seriesRows = await prisma.$queryRaw`
    SELECT
      date_trunc(${bucket}, "checkedAt") AS t,
      AVG("responseTimeMs")::float AS "avgMs",
      COALESCE(
        COUNT(*) FILTER (WHERE "isUp" = true)::float / NULLIF(COUNT(*), 0)::float * 100,
        0
      )::float AS "uptimePct"
    FROM "PingLog"
    WHERE "endpointId" = ${endpointId}
      AND "checkedAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const totalChecks = totals?.totalChecks || 0;
  const totalFailures = totals?.totalFailures || 0;
  const totalSuccess = totals?.totalSuccess || 0;
  const avgResponseTime = Math.round((totals?.avgResponseTime || 0) * 100) / 100;
  const p95Latency = Math.round((p95Result?.p95 || 0) * 100) / 100;
  const uptimePercentage = totalChecks > 0 ? Math.round((totalSuccess / totalChecks) * 10000) / 100 : 100;

  return {
    endpointId,
    period: window,
    window,
    uptimePercentage,
    avgResponseTime,
    p95Latency,
    totalChecks,
    totalFailures,
    currentStatus: endpoint.status,
    series: seriesRows.map((row) => ({
      t: row.t instanceof Date ? row.t.toISOString() : new Date(row.t).toISOString(),
      avgMs: Math.round((row.avgMs || 0) * 100) / 100,
      uptimePct: Math.round((row.uptimePct || 0) * 100) / 100,
    })),
  };
}

async function getEndpointLogs(endpointId, userId, { limit, offset }, window) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId },
  });

  if (!endpoint) {
    return null;
  }

  const since = window ? getSince(window) : null;
  const timeFilter = { endpointId };
  if (since) {
    timeFilter.checkedAt = { gte: since };
  }

  const [logs, total] = await Promise.all([
    prisma.pingLog.findMany({
      where: timeFilter,
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
    prisma.pingLog.count({ where: timeFilter }),
  ]);

  return { logs, total, limit, offset };
}

module.exports = { getEndpointStats, getEndpointLogs };
