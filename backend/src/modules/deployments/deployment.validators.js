const { z } = require('zod');

const createDeploymentSchema = z
  .object({
    repositoryId: z.string().uuid('repositoryId must be a valid UUID').optional(),
    environment: z.string().trim().min(1).max(100).optional(),
    commitSha: z.string().trim().regex(/^[0-9a-f]{7,40}$/i, 'commitSha must be a git sha').optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
    source: z.enum(['api', 'github_actions', 'hook']).optional(),
    description: z.string().trim().max(500).optional(),
    deployedAt: z.string().datetime().optional(),
  })
  .strict();

const updateDeploymentStatusSchema = z
  .object({
    status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

module.exports = { createDeploymentSchema, updateDeploymentStatusSchema };