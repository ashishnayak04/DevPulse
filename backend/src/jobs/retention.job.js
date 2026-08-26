const cron = require('node-cron');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const constants = require('../constants');

const CRON_EXPRESSION = '0 2 * * *'; // daily at 02:00
const SCOPE = 'RetentionJob';

async function purgeExpiredPingLogs() {
  const plans = Object.entries(constants.plans);
  let totalDeleted = 0;

  try {
    for (const [plan, config] of plans) {
      const cutoffDate = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);

      const result = await prisma.pingLog.deleteMany({
        where: {
          checkedAt: { lt: cutoffDate },
          endpoint: { user: { plan } },
        },
      });

      totalDeleted += result.count;
      if (result.count > 0) {
        logger.info(SCOPE, `Deleted ${result.count} PingLog rows for ${plan} users (>${config.retentionDays} days)`);
      }
    }

    logger.info(SCOPE, `Retention cleanup complete — ${totalDeleted} rows deleted`);
  } catch (err) {
    logger.error(SCOPE, `Data retention cleanup failed: ${err.message}`);
  }
}

function startRetentionJob() {
  cron.schedule(CRON_EXPRESSION, purgeExpiredPingLogs);
  logger.info(SCOPE, `Scheduled daily cleanup at ${CRON_EXPRESSION}`);
}

module.exports = { startRetentionJob, purgeExpiredPingLogs };
