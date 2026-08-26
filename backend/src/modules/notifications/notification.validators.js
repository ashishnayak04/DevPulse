const { z } = require('zod');

function getSupportedTimezones() {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Intl.supportedValuesOf unavailable — fall back to permissive validation
  }
  return null;
}

const SUPPORTED_TIMEZONES = getSupportedTimezones();

const booleanField = z.boolean().optional();

const pagerdutyKeySchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  },
  z
    .string()
    .trim()
    .min(10, 'PagerDuty Integration Key must be at least 10 characters')
    .max(200, 'PagerDuty Integration Key must be at most 200 characters')
    .nullable()
    .optional()
);

const quietHourSchema = z
  .number()
  .int('Quiet hour must be a whole number')
  .min(0, 'Quiet hour must be between 0 and 23')
  .max(23, 'Quiet hour must be between 0 and 23')
  .nullable()
  .optional();

const timezoneSchema = z
  .string({ required_error: 'Timezone is required' })
  .trim()
  .min(1, 'Timezone cannot be empty')
  .max(64, 'Timezone must be at most 64 characters')
  .refine(
    (tz) => (SUPPORTED_TIMEZONES ? SUPPORTED_TIMEZONES.includes(tz) : true),
    'Unsupported IANA timezone'
  )
  .optional();

const updateNotificationPreferencesSchema = z
  .object({
    emailEnabled: booleanField,
    emailOnDown: booleanField,
    emailOnRecovery: booleanField,
    pagerdutyEnabled: booleanField,
    pagerdutyKey: pagerdutyKeySchema,
    quietHoursEnabled: booleanField,
    quietHoursStart: quietHourSchema,
    quietHoursEnd: quietHourSchema,
    timezone: timezoneSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasStart = data.quietHoursStart !== undefined && data.quietHoursStart !== null;
    const hasEnd = data.quietHoursEnd !== undefined && data.quietHoursEnd !== null;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quiet hours start and end must be set together',
        path: hasStart ? ['quietHoursEnd'] : ['quietHoursStart'],
      });
    }
  });

module.exports = { updateNotificationPreferencesSchema, SUPPORTED_TIMEZONES };
