const { z } = require('zod');

const connectRepositorySchema = z
  .object({
    owner: z.string().trim().min(1, 'owner is required').max(100),
    name: z.string().trim().min(1, 'name is required').max(100),
  })
  .strict();

const syncRepositorySchema = z.object({});

module.exports = { connectRepositorySchema, syncRepositorySchema };