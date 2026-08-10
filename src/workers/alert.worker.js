const { Worker } = require('bullmq');
const redis = require('../lib/redis');
const logger = require('../lib/logger');
const constants = require('../constants');
const { processAlert } = require('../services/alert.service');

const SCOPE = 'AlertWorker';

function initAlertWorker() {
  const worker = new Worker(
    'alertQueue',
    async (job) => {
      await processAlert(job.data);
    },
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
  return worker;
}

module.exports = { initAlertWorker };
