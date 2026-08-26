const { z } = require('zod');

const slugRegex = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

const createTeamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters').max(50, 'Team name must be at most 50 characters'),
  slug: z
    .string()
    .regex(slugRegex, 'Slug must be 3-40 chars of lowercase letters, numbers and hyphens, starting/ending with a letter or number'),
});

const renameTeamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters').max(50, 'Team name must be at most 50 characters'),
});

const assignableRole = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);

const changeRoleSchema = z.object({
  role: assignableRole,
});

const inviteMemberSchema = z.object({
  email: z.string().email('Must be a valid email').toLowerCase(),
  role: assignableRole.default('MEMBER'),
});

const attachEndpointSchema = z.object({
  endpointId: z.string().uuid('endpointId must be a valid UUID'),
});

module.exports = {
  createTeamSchema,
  renameTeamSchema,
  changeRoleSchema,
  inviteMemberSchema,
  attachEndpointSchema,
};
