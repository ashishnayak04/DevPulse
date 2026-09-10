/* globals describe, it, expect */
const { aiResultSchema } = require('../../src/schemas/ai-result.schema');

function makeValidResult(overrides = {}) {
  return {
    summary: 'Investigation completed for the incident',
    rootCause: 'A recent deployment introduced a regression in the auth module',
    confidence: 0.85,
    evidence: [
      {
        sourceType: 'ping_log',
        sourceKey: 'ping-1',
        title: 'Endpoint returning 500',
        detail: 'HTTP 500 errors observed',
        classification: 'FACT',
      },
    ],
    affectedServices: ['auth-service', 'api-gateway'],
    relatedDeployment: null,
    relatedCommit: null,
    changedFiles: ['src/auth/login.js'],
    suggestedFix: 'Revert the auth module changes',
    risk: 'medium',
    verificationPlan: 'Deploy fix and monitor error rate for 30 minutes',
    toolCalls: [
      {
        toolName: 'get_incident',
        arguments: { incidentId: 'test-incident-id' },
        result: { incident: { id: 'test-incident-id' } },
        status: 'success',
        durationMs: 120,
      },
    ],
    ...overrides,
  };
}

describe('investigation worker', () => {
  describe('aiResultSchema validation', () => {
    it('accepts a valid investigation result', () => {
      const result = makeValidResult();
      const parsed = aiResultSchema.parse(result);
      expect(parsed.summary).toBe(result.summary);
      expect(parsed.rootCause).toBe(result.rootCause);
      expect(parsed.confidence).toBe(0.85);
      expect(parsed.evidence).toHaveLength(1);
      expect(parsed.toolCalls).toHaveLength(1);
    });

    it('rejects result with empty summary', () => {
      const result = makeValidResult({ summary: '' });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('rejects result with empty rootCause', () => {
      const result = makeValidResult({ rootCause: '' });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('rejects confidence below 0', () => {
      const result = makeValidResult({ confidence: -0.1 });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('rejects confidence above 1', () => {
      const result = makeValidResult({ confidence: 1.5 });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('defaults evidence to empty array', () => {
      const result = makeValidResult({ evidence: undefined });
      const parsed = aiResultSchema.parse(result);
      expect(parsed.evidence).toEqual([]);
    });

    it('defaults toolCalls to empty array', () => {
      const result = makeValidResult({ toolCalls: undefined });
      const parsed = aiResultSchema.parse(result);
      expect(parsed.toolCalls).toEqual([]);
    });

    it('accepts null for optional fields', () => {
      const result = makeValidResult({
        suggestedFix: null,
        risk: null,
        verificationPlan: null,
        relatedDeployment: null,
        relatedCommit: null,
      });
      const parsed = aiResultSchema.parse(result);
      expect(parsed.suggestedFix).toBeNull();
      expect(parsed.risk).toBeNull();
    });

    it('rejects invalid classification in evidence', () => {
      const result = makeValidResult({
        evidence: [{ sourceType: 'test', sourceKey: 'k', title: 't', classification: 'INVALID' }],
      });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('accepts all valid classifications', () => {
      for (const cls of ['FACT', 'INFERENCE', 'HYPOTHESIS']) {
        const result = makeValidResult({
          evidence: [{ sourceType: 'test', sourceKey: 'k', title: 't', classification: cls }],
        });
        expect(() => aiResultSchema.parse(result)).not.toThrow();
      }
    });

    it('accepts risk values low/medium/high/critical', () => {
      for (const risk of ['low', 'medium', 'high', 'critical']) {
        const result = makeValidResult({ risk });
        expect(() => aiResultSchema.parse(result)).not.toThrow();
      }
    });

    it('rejects unknown risk values', () => {
      expect(() => makeValidResult({ risk: 'extreme' })).not.toThrow();
      const result = makeValidResult({ risk: 'extreme' });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('requires evidence items to have sourceType', () => {
      const result = makeValidResult({
        evidence: [{ sourceKey: 'k', title: 't', classification: 'FACT' }],
      });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });

    it('requires toolCalls to have toolName', () => {
      const result = makeValidResult({
        toolCalls: [{ arguments: {}, status: 'success' }],
      });
      expect(() => aiResultSchema.parse(result)).toThrow();
    });
  });
});
