const { z } = require('zod');

const aiContextSchema = z.object({
  tool: z.string().min(1, 'tool is required').max(64, 'tool name too long'),
  arguments: z.record(z.unknown()).optional().default({}),
});

module.exports = { aiContextSchema };