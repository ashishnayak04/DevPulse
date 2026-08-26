const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const webhookController = require('./webhook.controller');
const { createWebhookSchema, updateWebhookSchema } = require('./webhook.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/', webhookController.list);
router.post('/', validate(createWebhookSchema), webhookController.create);
router.patch('/:id', validate(updateWebhookSchema), webhookController.update);
router.post('/:id/test', webhookController.test);
router.delete('/:id', webhookController.remove);

module.exports = router;
