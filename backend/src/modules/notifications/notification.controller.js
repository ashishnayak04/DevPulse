const notificationService = require('./notification.service');

async function getPreferences(req, res, next) {
  try {
    const prefs = await notificationService.getPreferences(req.user.id);
    res.json({ success: true, data: { prefs } });
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const prefs = await notificationService.updatePreferences(req.user.id, req.body);
    res.json({ success: true, data: { prefs } });
  } catch (err) {
    next(err);
  }
}

async function testPagerduty(req, res, next) {
  try {
    const result = await notificationService.sendTestEvent(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPreferences, updatePreferences, testPagerduty };
