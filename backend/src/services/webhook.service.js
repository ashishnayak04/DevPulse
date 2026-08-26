const axios = require('axios');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const constants = require('../constants');
const { generateHmacSignature } = require('../utils/hmac');

function formatMessageBody(type, payload) {
  const isDown = payload.event === 'endpoint.down';
  const emoji = isDown ? '🚨' : '✅';
  const status = isDown ? 'DOWN' : 'BACK UP';
  const line = `${emoji} DevPulse: *${payload.endpoint.name}* is ${status}\n${payload.endpoint.url} · ${payload.timestamp}`;

  if (type === 'SLACK') {
    return { text: line };
  }
  if (type === 'DISCORD') {
    return { content: line.replace(/\*/g, '**') };
  }
  return payload;
}

async function deliverWebhook({ webhookConfig, payload }) {
  const body = formatMessageBody(webhookConfig.type, payload);
  const payloadString = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };

  if (webhookConfig.type === 'GENERIC') {
    headers['X-DevPulse-Signature'] = generateHmacSignature(payloadString, webhookConfig.secret);
  }

  let attempt = 0;
  let success = false;
  let responseStatus = null;

  while (attempt < constants.workers.webhookMaxAttempts && !success) {
    attempt++;

    try {
      const response = await axios.post(webhookConfig.url, body, {
        headers,
        timeout: constants.workers.webhookTimeoutMs,
      });

      responseStatus = response.status;
      success = responseStatus >= 200 && responseStatus < 300;
    } catch (err) {
      responseStatus = err.response?.status || null;
      logger.error('Webhook', `Attempt ${attempt} failed for ${webhookConfig.url}: ${err.message}`);
    }

    await prisma.webhookDelivery.create({
      data: {
        webhookConfigId: webhookConfig.id,
        payload,
        responseStatus,
        attempt,
        success,
      },
    });

    if (!success && attempt < constants.workers.webhookMaxAttempts) {
      const delay = constants.workers.webhookBaseRetryDelayMs * Math.pow(2, attempt - 1);
      logger.warn('Webhook', `Retrying ${webhookConfig.url} in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (success) {
    logger.info('Webhook', `Delivered to ${webhookConfig.url}`);
  } else {
    logger.error('Webhook', `Failed after ${constants.workers.webhookMaxAttempts} attempts: ${webhookConfig.url}`);
  }

  return success;
}

async function deliverToAllWebhooks(userId, payload) {
  const webhookConfigs = await prisma.webhookConfig.findMany({ where: { userId } });

  for (const webhookConfig of webhookConfigs) {
    await deliverWebhook({ webhookConfig, payload });
  }
}

module.exports = { deliverWebhook, deliverToAllWebhooks };
