const { z } = require('zod');
const constants = require('../../constants');

const intervalValidation = z
  .number()
  .int()
  .min(constants.monitoring.minIntervalMs, 'Minimum interval is 10 seconds')
  .max(constants.monitoring.maxIntervalMs, 'Maximum interval is 1 hour');

const createEndpointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL'),
  intervalMs: intervalValidation.optional().default(constants.monitoring.defaultIntervalMs),
});

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  intervalMs: intervalValidation.optional(),
});

module.exports = { createEndpointSchema, updateEndpointSchema };
