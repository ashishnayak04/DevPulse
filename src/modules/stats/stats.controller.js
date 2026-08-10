const statsService = require('./stats.service');

async function getStats(req, res, next) {
  try {
    const stats = await statsService.getEndpointStats(req.params.id, req.user.id);

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

module.exports = { getStats };
