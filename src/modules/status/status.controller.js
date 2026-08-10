const statusService = require('./status.service');

async function getPublicStatus(req, res, next) {
  try {
    const result = await statusService.getPublicStatus(req.params.username);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({ success: true, data: result.data, cached: result.cached });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicStatus };
