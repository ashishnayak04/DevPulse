const { Queue } = require('bullmq');
const redis = require('../lib/redis');

const alertQueue = new Queue('alertQueue', { connection: redis });

module.exports = { alertQueue };
