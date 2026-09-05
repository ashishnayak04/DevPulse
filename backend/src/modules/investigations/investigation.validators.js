const { z } = require('zod');

const triggerInvestigationSchema = z.object({
  incidentId: z.string().uuid('incidentId must be a valid UUID'),
});

const rerunInvestigationSchema = z.object({});

module.exports = { triggerInvestigationSchema, rerunInvestigationSchema };