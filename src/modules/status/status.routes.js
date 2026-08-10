const express = require('express');
const statusController = require('./status.controller');

const router = express.Router();

router.get('/:username', statusController.getPublicStatus);

module.exports = router;
