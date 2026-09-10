const {
  triggerInvestigationSchema,
  rerunInvestigationSchema,
} = require('../../src/modules/investigations/investigation.validators');

describe('triggerInvestigationSchema', () => {
  it('accepts valid UUID', () => {
    const data = { incidentId: '550e8400-e29b-41d4-a716-446655440000' };
    expect(() => triggerInvestigationSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid UUID', () => {
    const data = { incidentId: 'not-a-uuid' };
    expect(() => triggerInvestigationSchema.parse(data)).toThrow();
  });

  it('rejects missing incidentId', () => {
    expect(() => triggerInvestigationSchema.parse({})).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => triggerInvestigationSchema.parse({ incidentId: '' })).toThrow();
  });
});

describe('rerunInvestigationSchema', () => {
  it('accepts empty object', () => {
    expect(() => rerunInvestigationSchema.parse({})).not.toThrow();
  });
});
