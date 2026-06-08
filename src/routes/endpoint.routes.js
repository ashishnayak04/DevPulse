const express = require('express');
const { validate } = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');
const endpointController = require('../controllers/endpoint.controller');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const createEndpointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL'),
  intervalMs: z
    .number()
    .int()
    .min(10000, 'Minimum interval is 10 seconds')
    .max(3600000, 'Maximum interval is 1 hour')
    .optional()
    .default(60000),
});

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  intervalMs: z
    .number()
    .int()
    .min(10000, 'Minimum interval is 10 seconds')
    .max(3600000, 'Maximum interval is 1 hour')
    .optional(),
});

// All routes require authentication
router.use(verifyToken);

router.post('/', validate(createEndpointSchema), endpointController.create);
router.get('/', endpointController.list);
router.get('/:id', endpointController.getOne);
router.patch('/:id', validate(updateEndpointSchema), endpointController.update);
router.delete('/:id', endpointController.remove);

module.exports = router;
