const internalService = require('./internal.service');

async function aiContext(req, res, next) {
  try {
    const data = await internalService.runTool(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { aiContext };