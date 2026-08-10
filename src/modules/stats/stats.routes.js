const express = require('express');
const { verifyToken } = require('../../middleware/authenticate');
const statsController = require('./stats.controller');

const router = express.Router();

router.get('/:id/stats', verifyToken, statsController.getStats);

module.exports = router;
