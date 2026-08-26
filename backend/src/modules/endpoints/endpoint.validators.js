const { z } = require('zod');
const constants = require('../../constants');

const intervalValidation = z
  .number()
  .int()
  .min(constants.monitoring.minIntervalMs, 'Minimum interval is 10 seconds')
  .max(constants.monitoring.maxIntervalMs, 'Maximum interval is 1 hour');

const methodValidation = z.enum(['GET', 'POST', 'HEAD', 'PUT'], {
  errorMap: () => ({ message: 'Method must be one of GET, POST, HEAD, PUT' }),
});

const headersValidation = z
  .record(z.string().trim().min(1, 'Header name cannot be empty').max(128), z.string().max(500, 'Header value must be at most 500 characters'))
  .superRefine((val, ctx) => {
    const keys = Object.keys(val || {});
    if (keys.length > 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At most 10 custom headers are allowed' });
    }
    for (const key of keys) {
      if (/[\r\n]/.test(key) || /[\r\n]/.test(val[key])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Header "${key}" contains invalid newline characters`, path: [key] });
      }
    }
  })
  .nullable()
  .transform((val) => val || {});

const bodyValidation = z.string().max(10000, 'Body must be at most 10000 characters').nullable();

const expectedStatusCodesValidation = z
  .array(z.number().int().min(100).max(599))
  .max(20, 'At most 20 expected status codes')
  .default([]);

const keywordMatchValidation = z.string().trim().min(1, 'Keyword match cannot be empty').max(200).nullable();

const sslCheckValidation = z.boolean();

const sslExpiryDaysValidation = z
  .number()
  .int()
  .min(7, 'sslExpiryDays must be between 7 and 90')
  .max(90, 'sslExpiryDays must be between 7 and 90');

const createEndpointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL'),
  intervalMs: intervalValidation.optional().default(constants.monitoring.defaultIntervalMs),
  method: methodValidation.default('GET'),
  headers: headersValidation.optional(),
  body: bodyValidation.optional(),
  expectedStatusCodes: expectedStatusCodesValidation,
  keywordMatch: keywordMatchValidation.optional(),
  sslCheck: sslCheckValidation.default(false),
  sslExpiryDays: sslExpiryDaysValidation.default(30),
});

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  intervalMs: intervalValidation.optional(),
  method: methodValidation.optional(),
  headers: headersValidation.optional(),
  body: bodyValidation.optional(),
  expectedStatusCodes: expectedStatusCodesValidation.optional(),
  keywordMatch: keywordMatchValidation.optional(),
  sslCheck: sslCheckValidation.optional(),
  sslExpiryDays: sslExpiryDaysValidation.optional(),
});

module.exports = { createEndpointSchema, updateEndpointSchema };
