const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const notificationController = require('./notification.controller');
const { updateNotificationPreferencesSchema } = require('./notification.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/preferences', notificationController.getPreferences);
router.patch('/preferences', validate(updateNotificationPreferencesSchema), notificationController.updatePreferences);
router.post('/pagerduty/test', notificationController.testPagerduty);

module.exports = router;
