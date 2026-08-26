const { z } = require('zod');

const createIncidentUpdateSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message is required')
    .max(500, 'Message must be 500 characters or fewer'),
});

module.exports = { createIncidentUpdateSchema };
