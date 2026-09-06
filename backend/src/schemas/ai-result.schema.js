const { z } = require('zod');

const evidenceSchema = z.object({
  sourceType: z.string().min(1).max(64),
  sourceKey: z.string().min(1).max(256),
  title: z.string().min(1).max(512),
  detail: z.string().max(4096).nullable().optional(),
  classification: z.enum(['FACT', 'INFERENCE', 'HYPOTHESIS']).default('FACT'),
  sourceUrl: z.string().url().max(1024).nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
});

const toolCallSchema = z.object({
  toolName: z.string().min(1).max(64),
  arguments: z.record(z.unknown()).default({}),
  result: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['success', 'error']).default('success'),
  durationMs: z.number().int().nonnegative().nullable().optional(),
});

const aiResultSchema = z.object({
  summary: z.string().min(1).max(4096),
  rootCause: z.string().min(1).max(8192),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema).max(200).default([]),
  affectedServices: z.array(z.string().min(1).max(128)).max(50).default([]),
  relatedDeployment: z.string().min(1).max(64).nullable().optional(),
  relatedCommit: z.string().min(1).max(64).nullable().optional(),
  changedFiles: z.array(z.string().min(1).max(512)).max(100).default([]),
  suggestedFix: z.string().max(16384).nullable().optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  verificationPlan: z.string().max(16384).nullable().optional(),
  toolCalls: z.array(toolCallSchema).max(200).default([]),
});

module.exports = { aiResultSchema, evidenceSchema, toolCallSchema };