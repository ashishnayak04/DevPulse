const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const apikeyController = require('./apikey.controller');
const { createApiKeySchema } = require('./apikey.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/', apikeyController.list);
router.post('/', validate(createApiKeySchema), apikeyController.create);
router.delete('/:id', apikeyController.remove);

module.exports = router;
