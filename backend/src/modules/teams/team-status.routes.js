const express = require('express');
const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');

const router = express.Router();

// PUBLIC — no auth. Mounted at '/api/status' BEFORE the user status router,
// so '/team/:slug' is matched before any conflicting user routes.

async function getTeamStatus(req, res, next) {
  try {
    const team = await prisma.team.findUnique({ where: { slug: req.params.slug } });
    if (!team) {
      throw new HttpError('Team not found', { statusCode: 404, code: 'TEAM_NOT_FOUND' });
    }

    const teamEndpoints = await prisma.teamEndpoint.findMany({
      where: { teamId: team.id, endpoint: { isActive: true } },
      orderBy: { endpoint: { name: 'asc' } },
      include: {
        endpoint: { select: { id: true, name: true, url: true, status: true } },
      },
    });

    const endpointIds = teamEndpoints.map((te) => te.endpoint.id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Same aggregate approach as stats.service.getEndpointStats, grouped per endpoint.
    const aggRows =
      endpointIds.length > 0
        ? await prisma.$queryRaw`
            SELECT
              "endpointId",
              COUNT(*)::int AS "totalChecks",
              COUNT(*) FILTER (WHERE "isUp" = true)::int AS "totalSuccess",
              COALESCE(AVG("responseTimeMs"), 0)::float AS "avgResponse",
              MAX("checkedAt") AS "lastChecked"
            FROM "PingLog"
            WHERE "endpointId" = ANY(${endpointIds}::uuid[])
              AND "checkedAt" > ${since}
            GROUP BY "endpointId"
          `
        : [];

    const aggByEndpoint = new Map(aggRows.map((row) => [row.endpointId, row]));

    const endpoints = teamEndpoints.map((te) => {
      const ep = te.endpoint;
      const agg = aggByEndpoint.get(ep.id);
      const totalChecks = agg?.totalChecks || 0;
      const totalSuccess = agg?.totalSuccess || 0;

      return {
        id: ep.id,
        name: ep.name,
        url: ep.url,
        status: ep.status,
        isUp: ep.status === 'UP',
        uptime24h: totalChecks > 0 ? Math.round((totalSuccess / totalChecks) * 10000) / 100 : null,
        avgResponse24h: agg ? Math.round((agg.avgResponse || 0) * 100) / 100 : null,
        lastCheckedAt: agg?.lastChecked || null,
      };
    });

    res.json({
      success: true,
      data: {
        team: { name: team.name, slug: team.slug },
        overall: {
          up: endpoints.filter((ep) => ep.isUp).length,
          down: endpoints.filter((ep) => !ep.isUp).length,
          total: endpoints.length,
        },
        endpoints,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

router.get('/team/:slug', getTeamStatus);

module.exports = router;
