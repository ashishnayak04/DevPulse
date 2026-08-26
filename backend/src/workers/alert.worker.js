const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const constants = require('../constants');
const { sendAlertEmail } = require('../services/email.service');
const { generateDownEmail, generateUpEmail } = require('../templates/email-templates');
const { deliverToAllWebhooks } = require('../services/webhook.service');
const {
  getPreferences,
  buildPagerdutyEvent,
  sendPagerdutyEvent,
} = require('../modules/notifications/notification.service');

const SCOPE = 'AlertWorker';

let alertWorker = null;

// Mirrors NotificationPreference column defaults — used if preferences
// cannot be loaded so alerts degrade to the pre-preferences behaviour.
const FALLBACK_PREFS = Object.freeze({
  emailEnabled: true,
  emailOnDown: true,
  emailOnRecovery: true,
  pagerdutyEnabled: false,
  pagerdutyKey: null,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'UTC',
});

function isDownLike(type) {
  return type === 'DOWN' || type === 'SSL_EXPIRY';
}

function getCurrentHourInZone(timeZone) {
  try {
    return Number(new Date().toLocaleString('en-US', { timeZone, hour12: false, hour: 'numeric' })) % 24;
  } catch (err) {
    logger.warn(SCOPE, `Invalid timezone "${timeZone}", falling back to server time: ${err.message}`);
    return new Date().getHours();
  }
}

// Supports wrap-around windows (e.g. start 22, end 6 → 22:00–06:00).
function isInQuietHours(start, end, hour) {
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

function resolveEmailSkipReason(prefs, type) {
  if (!prefs.emailEnabled) return 'email notifications disabled';
  if (type === 'UP' && !prefs.emailOnRecovery) return 'recovery emails disabled';
  if (isDownLike(type) && !prefs.emailOnDown) return 'DOWN emails disabled';

  if (
    prefs.quietHoursEnabled &&
    prefs.quietHoursStart !== null &&
    prefs.quietHoursStart !== undefined &&
    prefs.quietHoursEnd !== null &&
    prefs.quietHoursEnd !== undefined
  ) {
    const hour = getCurrentHourInZone(prefs.timezone);
    if (isInQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, hour)) {
      const pad = (n) => String(n).padStart(2, '0');
      return `quiet hours active (${pad(prefs.quietHoursStart)}:00–${pad(prefs.quietHoursEnd)}:00 ${prefs.timezone})`;
    }
  }

  return null;
}

function buildEmail(type, endpointName, details) {
  if (type === 'UP') {
    return { subject: `[RECOVERY] ${endpointName} is back UP`, html: generateUpEmail(details) };
  }
  if (type === 'SSL_EXPIRY') {
    return {
      subject: `[ALERT] ${endpointName} — SSL certificate expiring`,
      html: generateDownEmail(details),
    };
  }
  return { subject: `[ALERT] ${endpointName} is DOWN`, html: generateDownEmail(details) };
}

function buildPagerdutySummary(type, endpointName) {
  if (type === 'SSL_EXPIRY') return `${endpointName}: SSL certificate is expiring soon`;
  return `${endpointName} is DOWN`;
}

async function deliverPagerduty(prefs, { endpointId, type, endpointName }) {
  if (!prefs.pagerdutyEnabled || !prefs.pagerdutyKey) return;

  try {
    if (type === 'UP') {
      // Resolve the incident previously opened under the DOWN dedup key.
      await sendPagerdutyEvent(
        buildPagerdutyEvent({
          routingKey: prefs.pagerdutyKey,
          eventAction: 'resolve',
          dedupKey: `devpulse-${endpointId}-DOWN`,
          summary: `${endpointName} recovered`,
          severity: 'info',
        })
      );
      logger.info(SCOPE, `PagerDuty incident resolved for ${endpointName}`);
      return;
    }

    await sendPagerdutyEvent(
      buildPagerdutyEvent({
        routingKey: prefs.pagerdutyKey,
        eventAction: 'trigger',
        dedupKey: `devpulse-${endpointId}-${type}`,
        summary: buildPagerdutySummary(type, endpointName),
        severity: type === 'SSL_EXPIRY' ? 'warning' : 'critical',
      })
    );
    logger.info(SCOPE, `PagerDuty event triggered for ${endpointName} (${type})`);
  } catch (err) {
    logger.error(SCOPE, `PagerDuty delivery failed for ${endpointName} (${type}): ${err.message}`);
  }
}

async function handleAlertJob(job) {
  const { endpointId, userId, type, endpointName, endpointUrl, responseTimeMs, failureCount } =
    job.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    logger.warn(SCOPE, `User ${userId} not found, skipping alert`);
    return;
  }

  let prefs;
  try {
    prefs = await getPreferences(userId);
  } catch (err) {
    logger.error(SCOPE, `Failed to load preferences for user ${userId}, using defaults: ${err.message}`);
    prefs = FALLBACK_PREFS;
  }

  await prisma.alert.create({ data: { endpointId, type } });

  // ─── Email path (gated by preferences) ────────────────────
  const skipReason = resolveEmailSkipReason(prefs, type);
  if (skipReason) {
    logger.info(SCOPE, `Email skipped for ${endpointName} (${type}) — ${skipReason}`);
  } else {
    const { subject, html } = buildEmail(type, endpointName, {
      endpointName,
      endpointUrl,
      failureCount: failureCount || 3,
      responseTime: responseTimeMs || null,
      checkedAt: new Date().toISOString(),
    });

    try {
      await sendAlertEmail({ to: user.email, subject, html });
      logger.info(SCOPE, `Email sent to ${user.email} — ${type}`);
    } catch (err) {
      logger.error(SCOPE, `Email failed: ${err.message}`);
    }
  }

  // ─── PagerDuty path (own toggle; unaffected by quiet hours) ──
  await deliverPagerduty(prefs, { endpointId, type, endpointName });

  // ─── Webhooks (unchanged) ─────────────────────────────────
  const payload = {
    event: type === 'UP' ? 'endpoint.up' : 'endpoint.down',
    endpoint: { id: endpointId, name: endpointName, url: endpointUrl },
    timestamp: new Date().toISOString(),
  };

  await deliverToAllWebhooks(userId, payload);
}

function initAlertWorker() {
  const worker = new Worker(
    'alertQueue',
    handleAlertJob,
    {
      connection: redis,
      concurrency: constants.workers.alertConcurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(SCOPE, `Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(SCOPE, `Worker error: ${err.message}`);
  });

  logger.info(SCOPE, 'Started');
  alertWorker = worker;
  return worker;
}

function getAlertWorker() {
  return alertWorker;
}

module.exports = { initAlertWorker, getAlertWorker };
