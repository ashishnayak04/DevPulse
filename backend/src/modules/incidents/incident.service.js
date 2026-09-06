const prisma = require('../../lib/prisma');
const { Prisma } = require('@prisma/client');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');

const MINUTE_MS = 60 * 1000;

const incidentSummarySelect = {
  id: true,
  startedAt: true,
  resolvedAt: true,
  durationMs: true,
  acknowledged: true,
  endpoint: { select: { id: true, name: true, url: true } },
  _count: { select: { updates: true } },
};

function ownershipWhere(user) {
  if (user.role === 'ADMIN') {
    return {};
  }
  return { endpoint: { userId: user.id } };
}

function parseListQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, constants.pagination.maxLimit);
  const allowedStatuses = ['open', 'resolved', 'all'];
  const status = allowedStatuses.includes(query.status) ? query.status : 'all';
  return { page, limit, status };
}

function statusWhere(status) {
  if (status === 'open') {
    return { resolvedAt: null };
  }
  if (status === 'resolved') {
    return { resolvedAt: { not: null } };
  }
  return {};
}

function serializeSummary(incident) {
  return {
    id: incident.id,
    endpoint: incident.endpoint,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationMs: incident.durationMs,
    acknowledged: incident.acknowledged,
    status: incident.resolvedAt ? 'resolved' : 'open',
    _count: incident._count,
  };
}

async function assertOwnedIncident(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    select: { id: true },
  });
  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
}

async function listIncidents(user, rawQuery) {
  const { page, limit, status } = parseListQuery(rawQuery);

  const where = { ...ownershipWhere(user), ...statusWhere(status) };

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: incidentSummarySelect,
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    items: incidents.map(serializeSummary),
    total,
    page,
    limit,
  };
}

async function getIncident(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    include: {
      endpoint: { select: { id: true, name: true, url: true } },
      updates: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const { updates, ...rest } = incident;
  return { ...rest, updates, status: incident.resolvedAt ? 'resolved' : 'open' };
}

async function addIncidentUpdate(incidentId, user, data) {
  await assertOwnedIncident(incidentId, user);

  return prisma.incidentUpdate.create({
    data: { incidentId, message: data.message },
    select: { id: true, incidentId: true, message: true, createdAt: true },
  });
}

async function acknowledgeIncident(incidentId, user) {
  await assertOwnedIncident(incidentId, user);

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: { acknowledged: true },
    select: incidentSummarySelect,
  });

  return serializeSummary(incident);
}

// ─── Phase 3: Incident Intelligence ───────────────────────

function event(type, occurredAt, data) {
  return { type, occurredAt, ...data };
}

function alertEvent(alert, incidentId) {
  const risk =
    alert.type === 'DOWN' || alert.type === 'SSL_EXPIRY' ? 'critical' : alert.type === 'UP' ? 'success' : 'info';
  return event('alert', alert.sentAt, {
    id: alert.id,
    title: `Alert: ${alert.type}`,
    detail: alert.type === 'UP' ? 'Endpoint recovered, UP alert sent' : `DOWN alert sent for the endpoint`,
    risk,
    alertType: alert.type,
    incidentId,
  });
}

function deploymentEvent(deployment) {
  const risk = deployment.status === 'failed' ? 'warning' : 'info';
  return event('deployment', deployment.deployedAt, {
    id: deployment.id,
    title: `Deployment to ${deployment.environment}`,
    detail: deployment.description || `${deployment.commitSha ? deployment.commitSha.slice(0, 7) : 'no commit'} → ${deployment.repository?.fullName || 'no repository'}`,
    risk,
    deployment: {
      id: deployment.id,
      status: deployment.status,
      environment: deployment.environment,
      commitSha: deployment.commitSha,
      repository: deployment.repository?.fullName || null,
      source: deployment.source,
    },
  });
}

function clusterFailures(pings) {
  const episodes = [];
  let current = null;
  let totalDown = 0;

  for (const ping of pings) {
    if (!ping.isUp) {
      totalDown += 1;
      if (!current) {
        current = { startedAt: ping.checkedAt, endedAt: ping.checkedAt, count: 1, first: ping };
      } else {
        current.endedAt = ping.checkedAt;
        current.count += 1;
      }
    } else if (current) {
      episodes.push(clusterOf(current));
      current = null;
    }
  }
  if (current) episodes.push(clusterOf(current));

  return { episodes, totalDown };
}

function clusterOf(current) {
  return {
    startedAt: current.startedAt,
    endedAt: current.endedAt,
    durationMs: new Date(current.endedAt).getTime() - new Date(current.startedAt).getTime(),
    count: current.count,
  };
}

function buildFailureEvents(episodes) {
  const events = [];
  for (const ep of episodes) {
    events.push(
      event('ping_failure_episode', ep.startedAt, {
        title: `Failure episode (${ep.count} failed ${ep.count === 1 ? 'check' : 'checks'})`,
        detail: `Consecutive failures from ${ep.startedAt.toISOString()} to ${ep.endedAt.toISOString()}`,
        risk: 'critical',
        episode: ep,
      })
    );
  }
  return events;
}

async function getTimeline(incidentId, user) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    include: {
      endpoint: { select: { id: true, name: true, url: true, userId: true } },
      updates: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  return buildTimelineForIncident(incident);
}

async function buildTimelineForIncident(incident) {
  const { intelligence } = constants;
  const startedAt = incident.startedAt;
  const endedAt = incident.resolvedAt || new Date();
  const windowStart = new Date(new Date(startedAt).getTime() - intelligence.preRollMinutes * MINUTE_MS);
  const windowEnd = new Date(new Date(endedAt).getTime() + intelligence.postRollMinutes * MINUTE_MS);

  const [pings, alerts, deployments] = await Promise.all([
    prisma.pingLog.findMany({
      where: { endpointId: incident.endpointId, checkedAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { checkedAt: 'asc' },
      take: intelligence.maxTimelinePings,
    }),
    prisma.alert.findMany({
      where: { endpointId: incident.endpointId, sentAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { sentAt: 'asc' },
    }),
    prisma.deployment.findMany({
      where: { userId: incident.endpoint.userId, deployedAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { deployedAt: 'asc' },
      take: intelligence.maxTimelineDeployments,
      include: {
        repository: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  const events = [];

  events.push(
    event('incident_opened', startedAt, {
      title: 'Incident opened',
      detail: `${incident.endpoint.name} transitioned to DOWN`,
      risk: 'warning',
    })
  );

  if (incident.acknowledged) {
    events.push(
      event('incident_acknowledged', incident.resolvedAt || endedAt, {
        title: 'Incident acknowledged',
        detail: 'Acknowledged by a team member',
        risk: 'info',
      })
    );
  }

  for (const update of incident.updates) {
    events.push(
      event('incident_update', update.createdAt, {
        id: update.id,
        title: 'Incident update',
        detail: update.message,
        risk: 'info',
      })
    );
  }

  for (const alert of alerts) {
    events.push(alertEvent(alert, alert.incidentId || incidentId));
  }

  for (const deployment of deployments) {
    events.push(deploymentEvent(deployment));
  }

  const { episodes, totalDown } = clusterFailures(pings);
  events.push(...buildFailureEvents(episodes));

  const firstFailurePing = pings.find((p) => !p.isUp);
  const firstFailureAt = firstFailurePing ? firstFailurePing.checkedAt : startedAt;
  const lastFailureAt = episodes.length > 0 ? episodes[episodes.length - 1].endedAt : firstFailureAt;

  const before = deployments.filter((d) => new Date(d.deployedAt).getTime() <= new Date(firstFailureAt).getTime());
  const likelyDeployment = before[before.length - 1] || null;

  const correlation = {
    window: { start: windowStart, end: windowEnd },
    samples: {
      total: pings.length,
      down: totalDown,
      up: pings.length - totalDown,
      errorRate: pings.length > 0 ? Number((totalDown / pings.length).toFixed(4)) : null,
      truncated: pings.length === intelligence.maxTimelinePings,
    },
    firstFailureAt,
    lastFailureAt,
    failureEpisodes: episodes,
    deployments: {
      beforeFailure: before.map((d) => d.id),
      afterFailure: deployments.filter((d) => !before.includes(d)).map((d) => d.id),
    },
    likelyDeployment: likelyDeployment
      ? {
          deploymentId: likelyDeployment.id,
          repository: likelyDeployment.repository?.fullName || null,
          environment: likelyDeployment.environment,
          commitSha: likelyDeployment.commitSha || null,
          deployedAt: likelyDeployment.deployedAt,
          gapSeconds: Math.max(
            0,
            Math.round((new Date(firstFailureAt).getTime() - new Date(likelyDeployment.deployedAt).getTime()) / 1000)
          ),
          relation: likelyDeployment.status === 'failed' ? 'failed_deployment' : 'likely_correlated',
        }
      : null,
  };

  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const investigation = await prisma.investigation.findUnique({
    where: { incidentId: incident.id },
    select: { id: true, status: true, summary: true },
  });

  return {
    incident: {
      id: incident.id,
      endpoint: incident.endpoint,
      status: incident.resolvedAt ? 'resolved' : 'open',
      startedAt,
      resolvedAt: incident.resolvedAt,
      acknowledged: incident.acknowledged,
      investigation: investigation ? { id: investigation.id, status: investigation.status } : null,
    },
    correlation,
    events,
  };
}

function buildSearchTerms(source) {
  const words = String(source || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 20);
  return words.join(' ');
}

async function getSimilarIncidents(incidentId, user, rawQuery) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, ...ownershipWhere(user) },
    include: { endpoint: { select: { id: true, name: true, userId: true } } },
  });

  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const limit = Math.min(
    Math.max(parseInt(rawQuery?.limit, 10) || constants.intelligence.similarDefaultLimit, 1),
    constants.intelligence.similarMaxLimit
  );

  return findSimilarForIncident(incident, {
    limit,
    ownerUserId: user.role === 'ADMIN' ? null : user.id,
  });
}

async function findSimilarForIncident(incident, { limit, ownerUserId }) {
  const incidentId = incident.id;

  const baseInvestigation = await prisma.investigation.findUnique({
    where: { incidentId },
    select: { summary: true, rootCause: true },
  });

  const searchTerm = buildSearchTerms(
    `${baseInvestigation?.summary || ''} ${baseInvestigation?.rootCause || ''} ${incident.endpoint.name}`
  );
  const userClause =
    ownerUserId === null ? Prisma.sql`TRUE` : Prisma.sql`e."userId" = ${ownerUserId}`;

  // OR-conjoin the search terms: plainto_tsquery AND-conjoins every word, and a
  // rich AI summary quickly yields a query no single candidate can satisfy
  // (score 0 for everything). OR keeps relevance meaningful and the endpoint
  // match still dominates the ordering as the first sort key.
  const terms = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];
  const tsExpr =
    terms.length > 0
      ? Prisma.sql`to_tsquery('english', ${terms.join(' | ')})`
      : Prisma.sql`to_tsquery('english', '')`;

  const rows = await prisma.$queryRaw`
    SELECT i.id,
           i."endpointId",
           i."startedAt",
           i."resolvedAt",
           e.name AS "endpointName",
           inv.summary,
           inv."rootCause",
           ts_rank_cd(
             to_tsvector('english', coalesce(inv.summary, '') || ' ' || coalesce(inv."rootCause", '') || ' ' || e.name),
             ${tsExpr}
           )::float AS score
    FROM "Incident" i
    JOIN "Endpoint" e ON e.id = i."endpointId"
    LEFT JOIN "Investigation" inv ON inv."incidentId" = i.id
    WHERE i.id <> ${incidentId}
      AND ${userClause}
    ORDER BY (e.id = ${incident.endpoint.id}) DESC,
             score DESC,
             ABS(EXTRACT(EPOCH FROM (i."startedAt" - ${incident.startedAt}))) ASC
    LIMIT ${limit}
  `;

  return {
    query: {
      term: searchTerm || null,
      endpointId: incident.endpoint.id,
      limit,
    },
    items: rows.map((row) => ({
      id: row.id,
      endpoint: { id: row.endpointId, name: row.endpointName },
      startedAt: row.startedAt,
      resolvedAt: row.resolvedAt,
      status: row.resolvedAt ? 'resolved' : 'open',
      score: row.score || 0,
      endpointMatch: row.endpointId === incident.endpoint.id,
      timeGapMinutes: Math.round(
        Math.abs(new Date(row.startedAt).getTime() - new Date(incident.startedAt).getTime()) / MINUTE_MS
      ),
      summary: row.summary || null,
      rootCause: row.rootCause || null,
    })),
  };
}

module.exports = {
  listIncidents,
  getIncident,
  addIncidentUpdate,
  acknowledgeIncident,
  getTimeline,
  getSimilarIncidents,
  buildTimelineForIncident,
  findSimilarForIncident,
};
