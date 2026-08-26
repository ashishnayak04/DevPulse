const { z, ZodError } = require('zod');

const updateUserSchema = z
  .object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
    plan: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined || data.plan !== undefined, {
    message: 'Provide at least one of role, isActive, or plan',
  });

const monitoringToggleSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(200).optional().nullable(),
});

const listUsersQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  plan: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  sort: z.enum(['createdAt', 'endpointCount']).default('createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const announcementSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(280, 'Message must be 280 characters or fewer'),
  type: z.enum(['info', 'warning', 'error']).default('info'),
});

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: messages.join('; '),
          },
        });
      }
      next(err);
    }
  };
}

module.exports = {
  updateUserSchema,
  monitoringToggleSchema,
  listUsersQuerySchema,
  announcementSchema,
  validateQuery,
};
