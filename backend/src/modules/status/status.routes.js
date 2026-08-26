const express = require('express');
const { validate } = require('../../middleware/validate');
const statusController = require('./status.controller');
const { subscribeSchema } = require('../statuspage/statuspage.validators');

const router = express.Router();

router.post('/:username/subscribe', validate(subscribeSchema), statusController.subscribe);
router.get('/:username/confirm', statusController.confirm);
router.get('/:username', statusController.getPublicStatus);

module.exports = router;
