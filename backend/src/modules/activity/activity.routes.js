const express = require('express');
const { verifyToken } = require('../../middleware/authenticate');
const activityController = require('./activity.controller');

const router = express.Router();

router.get('/activity/logs', verifyToken, activityController.getActivityFeed);
router.get('/:id/logs', verifyToken, activityController.getEndpointLogs);

module.exports = router;
