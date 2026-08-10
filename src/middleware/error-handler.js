const logger = require('../lib/logger');

function errorHandler(err, req, res, _next) {
  logger.error('Error', err.stack || err.message);

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `A record with that ${err.meta?.target?.join(', ') || 'field'} already exists`,
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { errorHandler };
