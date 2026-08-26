const activityService = require('./activity.service');

async function getActivityFeed(req, res, next) {
  try {
    const { limit, offset } = activityService.parsePagination(req.query);
    const filter = req.query.filter;

    const feed = await activityService.getActivityFeed(req.user.id, { limit, offset, filter });
    res.json({ success: true, data: feed });
  } catch (err) {
    next(err);
  }
}

async function getEndpointLogs(req, res, next) {
  try {
    const { limit, offset } = activityService.parsePagination(req.query);

    const result = await activityService.getEndpointLogs(req.params.id, req.user.id, { limit, offset });

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

module.exports = { getActivityFeed, getEndpointLogs };
