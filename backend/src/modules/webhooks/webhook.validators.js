const { z } = require('zod');

const webhookType = z.enum(['GENERIC', 'SLACK', 'DISCORD']).default('GENERIC');

const urlValidation = z
  .string()
  .url('Must be a valid URL')
  .regex(/^https?:\/\//, 'Webhook URL must use http or https');

const createWebhookSchema = z.object({
  url: urlValidation,
  type: webhookType,
});

const updateWebhookSchema = z.object({
  url: urlValidation.optional(),
  type: z.enum(['GENERIC', 'SLACK', 'DISCORD']).optional(),
});

module.exports = { createWebhookSchema, updateWebhookSchema };
