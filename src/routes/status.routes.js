const express = require('express');
const statusController = require('../controllers/status.controller');

const router = express.Router();

// GET /status/:username — public, no auth required
router.get('/:username', statusController.getPublicStatus);

module.exports = router;
