const express = require('express');
const { verifyToken } = require('../../middleware/authenticate');
const statsController = require('./stats.controller');

const router = express.Router();

const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

router.get('/:id/stats', verifyToken, statsController.getStats);
// Serves the same path as activity.routes (mounted after this router) but adds
// ?window= filtering; the UUID constraint keeps /activity/logs reachable.
router.get(`/:id(${UUID_PATTERN})/logs`, verifyToken, statsController.getLogs);

module.exports = router;
