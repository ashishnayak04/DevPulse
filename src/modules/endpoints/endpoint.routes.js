const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const endpointController = require('./endpoint.controller');
const { createEndpointSchema, updateEndpointSchema } = require('./endpoint.validators');

const router = express.Router();

router.use(verifyToken);

router.post('/', validate(createEndpointSchema), endpointController.create);
router.get('/', endpointController.list);
router.get('/:id', endpointController.getOne);
router.patch('/:id', validate(updateEndpointSchema), endpointController.update);
router.delete('/:id', endpointController.remove);

module.exports = router;
