const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const { buildTimelineForIncident, findSimilarForIncident } = require('../incidents/incident.service');
const { getFileContent } = require('../../services/github.service');

const MINUTE_MS = 60 * 1000;

async function resolveIncident(incidentId) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      endpoint: { select: { id: true, name: true, url: true, userId: true } },
      updates: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!incident) {
    throw new HttpError('Incident not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return incident;
}

async function resolveRepoForIncident(repositoryId, incident) {
  const repo = await prisma.gitRepository.findFirst({
    where: { id: repositoryId, userId: incident.endpoint.userId },
    select: { id: true, userId: true, owner: true, name: true, fullName: true, defaultBranch: true },
  });
  if (!repo) {
    throw new HttpError('Repository not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return repo;
}

async function resolveDeployment(deploymentId, incident) {
  return prisma.deployment.findFirst({
    where: { id: deploymentId, userId: incident.endpoint.userId },
    include: {
      repository: { select: { id: true, fullName: true } },
      commits: {
        include: {
          commit: {
            select: { id: true, sha: true, message: true, author: true, authorEmail: true, authorDate: true, url: true },
          },
        },
      },
    },
  });
}

const resolvers = {
  async get_incident({ incidentId }) {
    const incident = await resolveIncident(incidentId);
    const investigation = await prisma.investigation.findUnique({
      where: { incidentId },
      select: { id: true, status: true, summary: true, rootCause: true },
    });
    const failureZoom = new Date(incident.startedAt).getTime() - constants.intelligence.preRollMinutes * MINUTE_MS;
    const pings = await prisma.pingLog.findMany({
      where: { endpointId: incident.endpointId, checkedAt: { gte: new Date(failureZoom) }, isUp: false },
      orderBy: { checkedAt: 'asc' },
    });
    return {
      incident: {
        id: incident.id,
        endpointId: incident.endpointId,
        endpoint: incident.endpoint,
        status: incident.resolvedAt ? 'resolved' : 'open',
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        acknowledged: incident.acknowledged,
      },
      samples: {
        downSinceStart: pings.length,
        uptimeWindowStart: new Date(failureZoom).toISOString(),
      },
      investigation: investigation || null,
    };
  },

  async get_ping_logs({ incidentId, start, end, limit }) {
    const incident = await resolveIncident(incidentId);
    const clamp = Math.min(Math.max(parseInt(limit, 10) || 300, 1), 500);
    const windowStart = start ? new Date(start) : new Date(new Date(incident.startedAt).getTime() - constants.intelligence.preRollMinutes * MINUTE_MS);
    const windowEnd = end ? new Date(end) : incident.resolvedAt || new Date();
    const logs = await prisma.pingLog.findMany({
      where: { endpointId: incident.endpointId, checkedAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { checkedAt: 'asc' },
      take: clamp,
    });
    return {
      items: logs,
      truncated: logs.length === clamp,
    };
  },

  async get_alerts({ incidentId }) {
    const incident = await resolveIncident(incidentId);
    const windowStart = new Date(new Date(incident.startedAt).getTime() - constants.intelligence.preRollMinutes * MINUTE_MS);
    const windowEnd = incident.resolvedAt || new Date();
    const alerts = await prisma.alert.findMany({
      where: { endpointId: incident.endpointId, sentAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { sentAt: 'asc' },
    });
    return {
      items: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        sentAt: a.sentAt,
        incidentId: a.incidentId,
      })),
    };
  },

  async get_timeline({ incidentId }) {
    const incident = await resolveIncident(incidentId);
    return buildTimelineForIncident(incident);
  },

  async get_deployment({ incidentId, deploymentId }) {
    const incident = await resolveIncident(incidentId);
    const deployment = await resolveDeployment(deploymentId, incident);
    if (!deployment) {
      throw new HttpError('Deployment not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    return deployment;
  },

  async get_git_commit({ incidentId, repositoryId, sha }) {
    const incident = await resolveIncident(incidentId);
    await resolveRepoForIncident(repositoryId, incident);
    const commit = await prisma.gitCommit.findUnique({
      where: { repositoryId_sha: { repositoryId, sha } },
      select: { id: true, sha: true, message: true, author: true, authorEmail: true, authorDate: true, url: true },
    });
    if (!commit) {
      throw new HttpError('Commit not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    return { repositoryId, commit };
  },

  async get_git_diff({ incidentId, repositoryId, sha }) {
    const incident = await resolveIncident(incidentId);
    await resolveRepoForIncident(repositoryId, incident);
    const commit = await prisma.gitCommit.findUnique({
      where: { repositoryId_sha: { repositoryId, sha } },
      include: {
        fileChanges: { orderBy: { filename: 'asc' } },
        deploymentLinks: { include: { deployment: { select: { id: true, environment: true, deployedAt: true } } } },
      },
    });
    if (!commit) {
      throw new HttpError('Commit not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    return {
      commit: {
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        authorDate: commit.authorDate,
        url: commit.url,
      },
      files: commit.fileChanges,
      deployments: commit.deploymentLinks.map((l) => l.deployment),
    };
  },

  async get_changed_files({ incidentId, repositoryId, sha, baseSha }) {
    const incident = await resolveIncident(incidentId);
    await resolveRepoForIncident(repositoryId, incident);
    const commits = await prisma.gitCommit.findMany({
      where: { repositoryId },
      orderBy: { authorDate: 'desc' },
      take: 50,
      include: { fileChanges: { select: { filename: true, status: true, additions: true, deletions: true } } },
    });

    const anchored = sha ? commits.filter((c) => c.sha === sha) : [];
    const targetSha = sha || (commits[0] && commits[0].sha) || null;
    if (!targetSha) {
      return { repositoryId, baseSha: null, targetSha: null, files: [] };
    }
    if (sha && anchored.length === 0) {
      throw new HttpError('Commit not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const targetIndex = commits.findIndex((c) => c.sha === targetSha);
    if (targetIndex === -1) {
      throw new HttpError('Commit not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const range = baseSha
      ? commits.filter((c) => c.sha !== baseSha && commits.findIndex((x) => x.sha === baseSha) <= commits.indexOf(c))
      : commits.slice(0, Math.min(targetIndex + 1, 10));

    const files = new Map();
    for (const commit of range) {
      for (const change of commit.fileChanges) {
        files.set(change.filename, {
          filename: change.filename,
          status: change.status,
          additions: change.additions,
          deletions: change.deletions,
        });
      }
    }

    return {
      repositoryId,
      targetSha,
      baseSha: baseSha || (range.length > 0 ? range[range.length - 1].sha : null),
      files: Array.from(files.values()),
    };
  },

  async inspect_source_file({ incidentId, repositoryId, path, sha }) {
    const incident = await resolveIncident(incidentId);
    const repo = await resolveRepoForIncident(repositoryId, incident);
    return getFileContent({ owner: repo.owner, name: repo.name, path, ref: sha || repo.defaultBranch });
  },

  async search_similar_incidents({ incidentId, limit }) {
    const incident = await resolveIncident(incidentId);
    return findSimilarForIncident(incident, {
      limit: Math.min(Math.max(parseInt(limit, 10) || constants.intelligence.similarDefaultLimit, 1), 10),
      ownerUserId: incident.endpoint.userId,
    });
  },

  async get_historical_resolution({ incidentId }) {
    const incident = await resolveIncident(incidentId);
    const similar = await findSimilarForIncident(incident, {
      limit: 5,
      ownerUserId: incident.endpoint.userId,
    });
    const ids = similar.items.map((i) => i.id);
    if (ids.length === 0) {
      return { resolution: null };
    }
    const prior = await prisma.investigation.findFirst({
      where: { incidentId: { in: ids }, status: 'COMPLETED', suggestedFix: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        incidentId: true,
        summary: true,
        rootCause: true,
        suggestedFix: true,
        risk: true,
        verificationPlan: true,
        confidence: true,
        completedAt: true,
      },
    });
    return { resolution: prior || null };
  },

  async list_recent_investigations({ count }) {
    const limit = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
    return prisma.investigation.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        incidentId: true,
        summary: true,
        rootCause: true,
        risk: true,
        confidence: true,
        completedAt: true,
        incident: { select: { endpoint: { select: { id: true, name: true } } } },
      },
    });
  },
};

async function runTool({ tool, arguments: args = {} }) {
  if (typeof tool !== 'string' || tool.length === 0) {
    throw new HttpError('Tool name is required', { statusCode: 400, code: 'INVALID_TOOL' });
  }
  const fn = resolvers[tool];
  if (!fn) {
    throw new HttpError(`Unknown tool: ${tool}`, { statusCode: 400, code: 'UNKNOWN_TOOL' });
  }
  return fn(args);
}

module.exports = { runTool, resolvers };