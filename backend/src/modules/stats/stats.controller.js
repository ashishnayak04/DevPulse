const statsService = require('./stats.service');
const { parseWindowQuery } = require('./stats.validators');
const activityService = require('../activity/activity.service');

function resolveWindow(req, res) {
  const parsed = parseWindowQuery(req.query.window);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'window: must be one of 24h, 7d, 30d, 90d',
      },
    });
    return null;
  }
  return parsed.data;
}

function hasWindowParam(req) {
  return req.query.window !== undefined && req.query.window !== '';
}

async function getStats(req, res, next) {
  try {
    const window = resolveWindow(req, res);
    if (window === null) return;

    const stats = await statsService.getEndpointStats(req.params.id, req.user.id, window);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
    }

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function getLogs(req, res, next) {
  try {
    const { limit, offset } = activityService.parsePagination(req.query);

    let window = null;
    if (hasWindowParam(req)) {
      window = resolveWindow(req, res);
      if (window === null) return;
    }

    const result = await statsService.getEndpointLogs(req.params.id, req.user.id, { limit, offset }, window);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats, getLogs };
