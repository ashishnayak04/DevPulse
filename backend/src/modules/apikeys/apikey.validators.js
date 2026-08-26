const { z } = require('zod');

const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name must be at most 60 characters'),
});

module.exports = { createApiKeySchema };
