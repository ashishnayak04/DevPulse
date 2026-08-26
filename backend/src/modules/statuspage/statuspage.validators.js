const { z } = require('zod');

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a 6-digit hex color like #22d3ee')
  .nullable()
  .optional();

const logoUrl = z
  .union([z.literal(''), z.string().url('Must be a valid URL starting with http:// or https://')])
  .nullable()
  .optional();

const updateConfigSchema = z.object({
  title: z.string().max(80).nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  accentColor: hexColor,
  showLatency: z.boolean().optional(),
  logoUrl,
});

const isoDatetime = z.string().datetime();

const createMaintenanceSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(80),
    message: z.string().max(500).optional(),
    startsAt: isoDatetime,
    endsAt: isoDatetime,
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
});

module.exports = { updateConfigSchema, createMaintenanceSchema, subscribeSchema };
