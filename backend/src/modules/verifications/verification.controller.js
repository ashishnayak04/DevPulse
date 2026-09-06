const verificationService = require('./verification.service');

async function list(req, res, next) {
  try {
    const result = await verificationService.listVerifications(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const verification = await verificationService.getVerification(req.params.id, req.user);
    res.json({ success: true, data: { verification } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get };