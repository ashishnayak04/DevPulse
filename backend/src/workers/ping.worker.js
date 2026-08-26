const { Worker } = require('bullmq');
const axios = require('axios');
const tls = require('tls');
const prisma = require('../lib/prisma');
const redis = require('../lib/redis');
const logger = require('../lib/logger');
const constants = require('../constants');
const { alertQueue } = require('../queues/alert.queue');
const { invalidateStatusCache } = require('../modules/status/status.service');
const { isMonitoringEnabled } = require('../lib/platform-settings');

const SCOPE = 'PingWorker';
const SSL_ALERT_DEDUPE_HOURS = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let pingWorker = null;

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof key === 'string' && typeof value === 'string' && !/[\r\n]/.test(key) && !/[\r\n]/.test(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function performPing(endpoint) {
  const startTime = Date.now();

  try {
    const expectedCodes =
      Array.isArray(endpoint.expectedStatusCodes) && endpoint.expectedStatusCodes.length > 0
        ? endpoint.expectedStatusCodes
        : null;
    const keyword = endpoint.keywordMatch ? String(endpoint.keywordMatch).toLowerCase() : null;
    const method = endpoint.method || 'GET';

    const response = await axios.request({
      url: endpoint.url,
      method,
      timeout: constants.monitoring.pingTimeoutMs,
      validateStatus: () => true,
      headers: sanitizeHeaders(endpoint.headers),
      data: method === 'POST' || method === 'PUT' ? endpoint.body ?? undefined : undefined,
    });

    let isUp;
    if (expectedCodes) {
      isUp = expectedCodes.includes(response.status);
    } else {
      isUp = response.status >= 200 && response.status < 400;
    }

    if (isUp && keyword != null) {
      const bodyText =
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
      if (!bodyText.toLowerCase().includes(keyword)) {
        isUp = false;
        logger.info(SCOPE, `${endpoint.name}: keyword "${endpoint.keywordMatch}" not found in response`);
      }
    }

    return {
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime,
      isUp,
    };
  } catch (err) {
    logger.debug(SCOPE, `Ping failed for ${endpoint.url}: ${err.message}`);
    return {
      statusCode: null,
      responseTimeMs: Date.now() - startTime,
      isUp: false,
    };
  }
}

async function checkSslExpiry(endpoint) {
  if (!endpoint.sslCheck) return;

  try {
    const parsed = new URL(endpoint.url);
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 443;

    const cert = await new Promise((resolve, reject) => {
      const socket = tls.connect(
        { host, port, servername: host, rejectUnauthorized: false, timeout: 8000 },
        () => {
          try {
            const peerCert = socket.getPeerCertificate();
            socket.end();
            if (peerCert && (peerCert.valid_to || peerCert.validTo)) {
              resolve(peerCert);
            } else {
              reject(new Error('No certificate presented'));
            }
          } catch (e) {
            socket.destroy();
            reject(e);
          }
        }
      );
      socket.on('error', (e) => reject(e));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('TLS handshake timed out'));
      });
    });

    const validTo = new Date(cert.valid_to || cert.validTo);
    const daysLeft = Math.ceil((validTo.getTime() - Date.now()) / MS_PER_DAY);

    if (daysLeft <= endpoint.sslExpiryDays) {
      const dedupeCutoff = new Date(Date.now() - SSL_ALERT_DEDUPE_HOURS * 60 * 60 * 1000);
      const recentAlert = await prisma.alert.findFirst({
        where: {
          endpointId: endpoint.id,
          type: 'SSL_EXPIRY',
          sentAt: { gte: dedupeCutoff },
        },
      });

      if (!recentAlert) {
        await prisma.alert.create({
          data: { endpointId: endpoint.id, type: 'SSL_EXPIRY' },
        });
        logger.warn(
          SCOPE,
          `${endpoint.name}: certificate expires in ${daysLeft} day(s) — SSL_EXPIRY alert created`
        );
      }
    }
  } catch (err) {
    logger.debug(SCOPE, `SSL check failed for ${endpoint.url}: ${err.message}`);
  }
}

async function openIncident(endpointId, userId) {
  try {
    await prisma.incident.create({ data: { endpointId, startedAt: new Date() } });
    logger.info(SCOPE, `Incident opened for endpoint ${endpointId}`);
  } catch (err) {
    logger.error(SCOPE, `Failed to open incident for endpoint ${endpointId}: ${err.message}`);
  }
}

async function resolveOpenIncident(endpointId, userId) {
  try {
    const openIncidentRow = await prisma.incident.findFirst({
      where: { endpointId, resolvedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (!openIncidentRow) return;

    const resolvedAt = new Date();
    await prisma.incident.update({
      where: { id: openIncidentRow.id },
      data: {
        resolvedAt,
        durationMs: resolvedAt.getTime() - new Date(openIncidentRow.startedAt).getTime(),
      },
    });
    logger.info(SCOPE, `Incident ${openIncidentRow.id} resolved for endpoint ${endpointId}`);
  } catch (err) {
    logger.error(SCOPE, `Failed to resolve incident for endpoint ${endpointId}: ${err.message}`);
  }
}

async function enqueueStateTransitionAlert({ endpoint, userId, type, responseTimeMs, failureCount }) {
  await alertQueue.add('alert', {
    endpointId: endpoint.id,
    userId,
    type,
    endpointName: endpoint.name,
    endpointUrl: endpoint.url,
    responseTimeMs,
    failureCount,
  });
}

function emitPingResult(io, userId, result) {
  if (!io) return;
  io.to(`user:${userId}`).emit('ping:result', result);
}

async function invalidateUserStatusCache(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user) {
    await invalidateStatusCache(user.username);
  }
}

function initPingWorker(io) {
  const worker = new Worker(
    'pingQueue',
    async (job) => {
      const { endpointId, url, userId } = job.data;

      if (!(await isMonitoringEnabled())) {
        logger.info(SCOPE, 'Global monitoring disabled, skipping check');
        return;
      }

      const endpoint = await prisma.endpoint.findUnique({ where: { id: endpointId } });
      if (!endpoint || !endpoint.isActive) {
        logger.info(SCOPE, `Endpoint ${endpointId} is inactive or deleted, skipping`);
        return;
      }

      const { statusCode, responseTimeMs, isUp } = await performPing({ ...endpoint, url });
      const checkedAt = new Date();

      await prisma.pingLog.create({
        data: { endpointId, statusCode, responseTimeMs, isUp, checkedAt },
      });

      checkSslExpiry(endpoint).catch(() => {});

      let newFailures = endpoint.consecutiveFailures;
      if (isUp) {
        newFailures = 0;
        const previousStatus = endpoint.status;

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: { consecutiveFailures: 0, status: 'UP' },
        });

        if (previousStatus === 'DOWN') {
          await enqueueStateTransitionAlert({ endpoint, userId, type: 'UP', responseTimeMs, failureCount: 0 });
          logger.info(SCOPE, `${endpoint.name} recovered — alert queued`);
          await resolveOpenIncident(endpointId, userId);
        }
      } else {
        newFailures = endpoint.consecutiveFailures + 1;
        const updateData = { consecutiveFailures: newFailures };

        if (newFailures >= constants.monitoring.consecutiveFailuresThreshold && endpoint.status === 'UP') {
          updateData.status = 'DOWN';
          await enqueueStateTransitionAlert({ endpoint, userId, type: 'DOWN', responseTimeMs, failureCount: newFailures });
          logger.info(SCOPE, `${endpoint.name} is DOWN (${newFailures} failures) — alert queued`);
          await openIncident(endpointId, userId);
        }

        await prisma.endpoint.update({
          where: { id: endpointId },
          data: updateData,
        });
      }

      emitPingResult(io, userId, {
        endpointId,
        status: isUp ? 'UP' : newFailures >= constants.monitoring.consecutiveFailuresThreshold ? 'DOWN' : 'UP',
        responseTimeMs,
        statusCode,
        isUp,
        checkedAt: checkedAt.toISOString(),
      });

      await invalidateUserStatusCache(userId);

      logger.info(SCOPE, `${endpoint.name} → ${isUp ? 'UP' : 'DOWN'} ${statusCode || 'ERR'} (${responseTimeMs}ms)`);
    },
    {
      connection: redis,
      concurrency: constants.workers.pingConcurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(SCOPE, `Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(SCOPE, `Worker error: ${err.message}`);
  });

  logger.info(SCOPE, 'Started');
  pingWorker = worker;
  return worker;
}

function getPingWorker() {
  return pingWorker;
}

module.exports = { initPingWorker, getPingWorker };
