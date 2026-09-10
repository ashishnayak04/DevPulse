const { aiResultSchema, evidenceSchema, toolCallSchema } = require('../../src/schemas/ai-result.schema');

describe('evidenceSchema', () => {
  it('accepts valid evidence', () => {
    const data = {
      sourceType: 'ping',
      sourceKey: 'ping-log-123',
      title: 'Ping failed',
      detail: 'Endpoint returned 500',
      classification: 'FACT',
    };
    expect(() => evidenceSchema.parse(data)).not.toThrow();
  });

  it('defaults classification to FACT', () => {
    const data = { sourceType: 'test', sourceKey: 'k', title: 't' };
    const result = evidenceSchema.parse(data);
    expect(result.classification).toBe('FACT');
  });

  it('rejects empty sourceType', () => {
    const data = { sourceType: '', sourceKey: 'k', title: 't' };
    expect(() => evidenceSchema.parse(data)).toThrow();
  });

  it('rejects invalid classification', () => {
    const data = { sourceType: 'test', sourceKey: 'k', title: 't', classification: 'WRONG' };
    expect(() => evidenceSchema.parse(data)).toThrow();
  });

  it('accepts all valid classifications', () => {
    for (const c of ['FACT', 'INFERENCE', 'HYPOTHESIS']) {
      const data = { sourceType: 'test', sourceKey: 'k', title: 't', classification: c };
      expect(() => evidenceSchema.parse(data)).not.toThrow();
    }
  });

  it('allows optional fields', () => {
    const data = {
      sourceType: 'test',
      sourceKey: 'k',
      title: 't',
      sourceUrl: 'https://example.com',
      payload: { key: 'value' },
    };
    expect(() => evidenceSchema.parse(data)).not.toThrow();
  });
});

describe('toolCallSchema', () => {
  it('accepts valid tool call', () => {
    const data = { toolName: 'get_incident', arguments: { incidentId: '123' } };
    expect(() => toolCallSchema.parse(data)).not.toThrow();
  });

  it('defaults status to success', () => {
    const data = { toolName: 'test' };
    const result = toolCallSchema.parse(data);
    expect(result.status).toBe('success');
  });

  it('defaults arguments to empty object', () => {
    const data = { toolName: 'test' };
    const result = toolCallSchema.parse(data);
    expect(result.arguments).toEqual({});
  });

  it('rejects empty toolName', () => {
    const data = { toolName: '' };
    expect(() => toolCallSchema.parse(data)).toThrow();
  });

  it('rejects invalid status', () => {
    const data = { toolName: 'test', status: 'maybe' };
    expect(() => toolCallSchema.parse(data)).toThrow();
  });
});

describe('aiResultSchema', () => {
  const validResult = {
    summary: 'Investigation complete',
    rootCause: 'Cache misconfiguration',
    confidence: 0.85,
  };

  it('accepts minimal valid result', () => {
    expect(() => aiResultSchema.parse(validResult)).not.toThrow();
  });

  it('defaults evidence to empty array', () => {
    const result = aiResultSchema.parse(validResult);
    expect(result.evidence).toEqual([]);
  });

  it('defaults affectedServices to empty array', () => {
    const result = aiResultSchema.parse(validResult);
    expect(result.affectedServices).toEqual([]);
  });

  it('defaults changedFiles to empty array', () => {
    const result = aiResultSchema.parse(validResult);
    expect(result.changedFiles).toEqual([]);
  });

  it('rejects empty summary', () => {
    expect(() => aiResultSchema.parse({ ...validResult, summary: '' })).toThrow();
  });

  it('rejects empty rootCause', () => {
    expect(() => aiResultSchema.parse({ ...validResult, rootCause: '' })).toThrow();
  });

  it('rejects confidence below 0', () => {
    expect(() => aiResultSchema.parse({ ...validResult, confidence: -0.1 })).toThrow();
  });

  it('rejects confidence above 1', () => {
    expect(() => aiResultSchema.parse({ ...validResult, confidence: 1.1 })).toThrow();
  });

  it('accepts confidence at boundaries', () => {
    expect(() => aiResultSchema.parse({ ...validResult, confidence: 0 })).not.toThrow();
    expect(() => aiResultSchema.parse({ ...validResult, confidence: 1 })).not.toThrow();
  });

  it('accepts full result with all fields', () => {
    const full = {
      ...validResult,
      evidence: [
        { sourceType: 'ping', sourceKey: 'ping-1', title: 'Ping failed', classification: 'FACT' },
      ],
      affectedServices: ['api-gateway', 'auth-service'],
      relatedDeployment: 'abc123',
      relatedCommit: 'def456',
      changedFiles: ['src/server.js', 'src/cache.js'],
      suggestedFix: 'Update cache headers',
      risk: 'medium',
      verificationPlan: 'Deploy and monitor for 30 minutes',
      toolCalls: [{ toolName: 'get_incident', arguments: { id: '1' } }],
    };
    expect(() => aiResultSchema.parse(full)).not.toThrow();
  });

  it('rejects risk values not in enum', () => {
    expect(() => aiResultSchema.parse({ ...validResult, risk: 'catastrophic' })).toThrow();
  });

  it('accepts all valid risk values', () => {
    for (const r of ['low', 'medium', 'high', 'critical']) {
      expect(() => aiResultSchema.parse({ ...validResult, risk: r })).not.toThrow();
    }
  });

  it('accepts null for optional fields', () => {
    const data = {
      ...validResult,
      suggestedFix: null,
      risk: null,
      verificationPlan: null,
    };
    expect(() => aiResultSchema.parse(data)).not.toThrow();
  });
});
