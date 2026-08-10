const prisma = require('../../lib/prisma');

async function getEndpointStats(endpointId, userId) {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, userId },
  });

  if (!endpoint) {
    return null;
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totals] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "totalChecks",
      COUNT(*) FILTER (WHERE "isUp" = false)::int AS "totalFailures",
      COUNT(*) FILTER (WHERE "isUp" = true)::int AS "totalSuccess",
      COALESCE(AVG("responseTimeMs"), 0)::float AS "avgResponseTime"
    FROM "PingLog"
    WHERE "endpointId" = ${endpointId}
      AND "checkedAt" > ${twentyFourHoursAgo}
  `;

  const [p95Result] = await prisma.$queryRaw`
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "responseTimeMs") AS p95
    FROM "PingLog"
    WHERE "endpointId" = ${endpointId}
      AND "checkedAt" > NOW() - INTERVAL '24 hours'
  `;

  const totalChecks = totals?.totalChecks || 0;
  const totalFailures = totals?.totalFailures || 0;
  const totalSuccess = totals?.totalSuccess || 0;
  const avgResponseTime = Math.round((totals?.avgResponseTime || 0) * 100) / 100;
  const p95Latency = Math.round((p95Result?.p95 || 0) * 100) / 100;
  const uptimePercentage = totalChecks > 0 ? Math.round((totalSuccess / totalChecks) * 10000) / 100 : 100;

  return {
    endpointId,
    period: '24h',
    uptimePercentage,
    avgResponseTime,
    p95Latency,
    totalChecks,
    totalFailures,
    currentStatus: endpoint.status,
  };
}

module.exports = { getEndpointStats };
