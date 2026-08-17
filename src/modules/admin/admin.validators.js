const { z } = require('zod');

const updateUserSchema = z
  .object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'Provide at least one of role or isActive',
  });

module.exports = { updateUserSchema };
