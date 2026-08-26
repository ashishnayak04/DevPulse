const rateLimit = require('express-rate-limit');
const constants = require('../constants');

function createLimiter(max, windowMs = 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
      });
    },
  });
}

const apiLimiter = createLimiter(constants.rateLimit.globalMaxRequestsPerMinute);
const authLimiter = createLimiter(constants.rateLimit.authMaxRequestsPerMinute);

module.exports = { apiLimiter, authLimiter };
