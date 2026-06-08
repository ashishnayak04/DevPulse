const { Worker } = require('bullmq');
const prisma = require('../utils/prisma');
const axios = require('axios');
const redis = require('../utils/redis');
const { sendAlertEmail } = require('../utils/mailer');
const { generateDownEmail, generateUpEmail } = require('../utils/emailTemplates');
const { generateHmacSignature } = require('../utils/helpers');

/**
 * Initialize the alert worker.
 */
function initAlertWorker() {
  const worker = new Worker(
    'alertQueue',
    async (job) => {
      const { endpointId, userId, type, endpointName, endpointUrl, responseTimeMs, failureCount } = job.data;

      // Get the user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.log(`[AlertWorker] User ${userId} not found, skipping`);
        return;
      }

      // Record alert
      await prisma.alert.create({
        data: { endpointId, type },
      });

      // ─── Send email ───
      const subject =
        type === 'DOWN'
          ? `[ALERT] ${endpointName} is DOWN`
          : `[RECOVERY] ${endpointName} is back UP`;

      const html =
        type === 'DOWN'
          ? generateDownEmail({
              endpointName,
              endpointUrl,
              failureCount: failureCount || 3,
              responseTime: responseTimeMs || null,
              checkedAt: new Date().toISOString(),
            })
          : generateUpEmail({
              endpointName,
              endpointUrl,
              responseTime: responseTimeMs || null,
              checkedAt: new Date().toISOString(),
            });

      try {
        await sendAlertEmail({ to: user.email, subject, html });
        console.log(`[AlertWorker] Email sent to ${user.email} — ${type}`);
      } catch (err) {
        console.error(`[AlertWorker] Email failed:`, err.message);
      }

      // ─── Webhook delivery ───
      const webhookConfigs = await prisma.webhookConfig.findMany({
        where: { userId },
      });

      for (const webhook of webhookConfigs) {
        const payload = {
          event: type === 'DOWN' ? 'endpoint.down' : 'endpoint.up',
          endpoint: {
            id: endpointId,
            name: endpointName,
            url: endpointUrl,
          },
          timestamp: new Date().toISOString(),
        };

        const payloadString = JSON.stringify(payload);
        const signature = generateHmacSignature(payloadString, webhook.secret);

        let attempt = 0;
        let success = false;
        let responseStatus = null;
        const maxAttempts = 3;
        const baseDelay = 60000;

        while (attempt < maxAttempts && !success) {
          attempt++;

          try {
            const resp = await axios.post(webhook.url, payload, {
              headers: {
                'Content-Type': 'application/json',
                'X-DevPulse-Signature': signature,
              },
              timeout: 10000,
            });

            responseStatus = resp.status;
            success = responseStatus >= 200 && responseStatus < 300;
          } catch (err) {
            responseStatus = err.response?.status || null;
            console.error(`[AlertWorker] Webhook attempt ${attempt} failed for ${webhook.url}:`, err.message);
          }

          await prisma.webhookDelivery.create({
            data: {
              webhookConfigId: webhook.id,
              payload,
              responseStatus,
              attempt,
              success,
            },
          });

          if (!success && attempt < maxAttempts) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`[AlertWorker] Retrying webhook in ${delay / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (success) {
          console.log(`[AlertWorker] Webhook delivered to ${webhook.url}`);
        } else {
          console.error(`[AlertWorker] Webhook failed after ${maxAttempts} attempts: ${webhook.url}`);
        }
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[AlertWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[AlertWorker] Worker error:', err.message);
  });

  console.log('[AlertWorker] Started');
  return worker;
}

module.exports = { initAlertWorker };
