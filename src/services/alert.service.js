const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { sendAlertEmail } = require('./email.service');
const { generateDownEmail, generateUpEmail } = require('../templates/email-templates');
const { deliverToAllWebhooks } = require('./webhook.service');

const SCOPE = 'AlertService';

function buildSubject(type, endpointName) {
  return type === 'DOWN'
    ? `[ALERT] ${endpointName} is DOWN`
    : `[RECOVERY] ${endpointName} is back UP`;
}

function buildHtml(type, details) {
  return type === 'DOWN' ? generateDownEmail(details) : generateUpEmail(details);
}

async function processAlert({ endpointId, userId, type, endpointName, endpointUrl, responseTimeMs, failureCount }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    logger.warn(SCOPE, `User ${userId} not found, skipping alert`);
    return;
  }

  await prisma.alert.create({ data: { endpointId, type } });

  const subject = buildSubject(type, endpointName);
  const html = buildHtml(type, {
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

  const payload = {
    event: type === 'DOWN' ? 'endpoint.down' : 'endpoint.up',
    endpoint: { id: endpointId, name: endpointName, url: endpointUrl },
    timestamp: new Date().toISOString(),
  };

  await deliverToAllWebhooks(userId, payload);
}

module.exports = { processAlert };
