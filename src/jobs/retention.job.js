const cron = require('node-cron');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const constants = require('../constants');

const CRON_EXPRESSION = '0 2 * * *'; // daily at 02:00
const SCOPE = 'RetentionJob';

async function purgeExpiredPingLogs() {
  const cutoffDate = new Date(Date.now() - constants.retention.pingLogDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.pingLog.deleteMany({
      where: { checkedAt: { lt: cutoffDate } },
    });
    logger.info(SCOPE, `Deleted ${result.count} PingLog rows older than ${constants.retention.pingLogDays} days`);
  } catch (err) {
    logger.error(SCOPE, `Data retention cleanup failed: ${err.message}`);
  }
}

function startRetentionJob() {
  cron.schedule(CRON_EXPRESSION, purgeExpiredPingLogs);
  logger.info(SCOPE, `Scheduled daily cleanup at ${CRON_EXPRESSION}`);
}

module.exports = { startRetentionJob, purgeExpiredPingLogs };
