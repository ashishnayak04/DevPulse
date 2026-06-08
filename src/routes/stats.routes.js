const express = require('express');
const { verifyToken } = require('../middleware/auth');
const statsController = require('../controllers/stats.controller');

const router = express.Router();

// GET /endpoints/:id/stats — requires auth
router.get('/:id/stats', verifyToken, statsController.getStats);

module.exports = router;
