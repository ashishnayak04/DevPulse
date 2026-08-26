const prisma = require('../../lib/prisma');
const axios = require('axios');
const config = require('../../config/env');
const logger = require('../../lib/logger');
const HttpError = require('../../lib/http-error');

const SCOPE = 'Notifications';
const PD_EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue';
const AXIOS_TIMEOUT_MS = 10000;

async function getPreferences(userId) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.notificationPreference.create({ data: { userId } });
}

async function updatePreferences(userId, data) {
  const payload = { ...data };
  delete payload.quietHoursStart;
  delete payload.quietHoursEnd;

  // quietHoursStart/End are validated as a pair — only forward them together,
  // and only when at least one side was explicitly provided.
  if (data.quietHoursStart !== undefined || data.quietHoursEnd !== undefined) {
    payload.quietHoursStart = data.quietHoursStart ?? null;
    payload.quietHoursEnd = data.quietHoursEnd ?? null;
  }

  return prisma.notificationPreference.upsert({
    where: { userId },
    update: payload,
    create: { userId, ...payload },
  });
}

function buildPagerdutyEvent({ routingKey, eventAction, dedupKey, summary, severity }) {
  return {
    routing_key: routingKey,
    event_action: eventAction,
    dedup_key: dedupKey,
    payload: {
      summary,
      source: 'devpulse',
      severity,
      timestamp: new Date().toISOString(),
    },
    client: 'DevPulse',
    client_url: config.frontendUrl,
  };
}

async function sendPagerdutyEvent(event) {
  const response = await axios.post(PD_EVENTS_URL, event, { timeout: AXIOS_TIMEOUT_MS });
  if (response.status >= 400 || response.data?.status === 'invalid_event') {
    throw new Error(response.data?.message || `PagerDuty responded with status ${response.status}`);
  }
  return response.data;
}

async function sendTestEvent(userId) {
  const prefs = await getPreferences(userId);

  if (!prefs.pagerdutyEnabled || !prefs.pagerdutyKey) {
    throw new HttpError(
      'PagerDuty is not configured. Enable it and save an Integration Key first.',
      { statusCode: 400, code: 'PAGERDUTY_NOT_CONFIGURED' }
    );
  }

  const dedupKey = `devpulse-test-${userId}`;
  try {
    await sendPagerdutyEvent(
      buildPagerdutyEvent({
        routingKey: prefs.pagerdutyKey,
        eventAction: 'trigger',
        dedupKey,
        summary: 'DevPulse test incident — notifications are working',
        severity: 'info',
      })
    );
    logger.info(SCOPE, `Test event delivered to PagerDuty for user ${userId}`);
    return { delivered: true, dedup_key: dedupKey };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    logger.error(SCOPE, `PagerDuty test failed for user ${userId}: ${message}`);
    throw new HttpError(`PagerDuty error: ${message}`, {
      statusCode: 502,
      code: 'PAGERDUTY_ERROR',
    });
  }
}

module.exports = {
  getPreferences,
  updatePreferences,
  sendTestEvent,
  buildPagerdutyEvent,
  sendPagerdutyEvent,
};
