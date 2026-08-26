const IORedis = require('ioredis');
const config = require('../config/env');
const logger = require('./logger');

const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  logger.error('Redis', `Connection error: ${err.message}`);
});

redis.on('connect', () => {
  logger.info('Redis', 'Connected successfully');
});

module.exports = redis;
