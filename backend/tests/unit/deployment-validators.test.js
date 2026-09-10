const {
  createDeploymentSchema,
  updateDeploymentStatusSchema,
} = require('../../src/modules/deployments/deployment.validators');

describe('createDeploymentSchema', () => {
  it('accepts minimal valid deployment', () => {
    const data = { environment: 'production' };
    expect(() => createDeploymentSchema.parse(data)).not.toThrow();
  });

  it('accepts valid commitSha', () => {
    const data = { commitSha: 'a'.repeat(40) };
    const result = createDeploymentSchema.parse(data);
    expect(result.commitSha).toBe('a'.repeat(40));
  });

  it('accepts short commitSha (7 chars)', () => {
    const data = { commitSha: 'abc1234' };
    expect(() => createDeploymentSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid commitSha', () => {
    const data = { commitSha: 'zzz-not-a-sha' };
    expect(() => createDeploymentSchema.parse(data)).toThrow();
  });

  it('accepts valid statuses', () => {
    for (const status of ['pending', 'in_progress', 'completed', 'failed']) {
      expect(() => createDeploymentSchema.parse({ status })).not.toThrow();
    }
  });

  it('rejects invalid status', () => {
    expect(() => createDeploymentSchema.parse({ status: 'unknown' })).toThrow();
  });

  it('accepts valid source', () => {
    for (const source of ['api', 'github_actions', 'hook']) {
      expect(() => createDeploymentSchema.parse({ source })).not.toThrow();
    }
  });

  it('rejects invalid source', () => {
    expect(() => createDeploymentSchema.parse({ source: 'manual' })).toThrow();
  });

  it('accepts valid deployedAt', () => {
    const data = { deployedAt: '2026-09-10T12:00:00.000Z' };
    expect(() => createDeploymentSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid deployedAt', () => {
    const data = { deployedAt: 'not-a-date' };
    expect(() => createDeploymentSchema.parse(data)).toThrow();
  });

  it('rejects unknown fields (strict mode)', () => {
    const data = { environment: 'prod', unknownField: 'value' };
    expect(() => createDeploymentSchema.parse(data)).toThrow();
  });

  it('accepts description', () => {
    const data = { description: 'Deploy v1.2.3' };
    expect(() => createDeploymentSchema.parse(data)).not.toThrow();
  });
});

describe('updateDeploymentStatusSchema', () => {
  it('accepts valid status update', () => {
    expect(() => updateDeploymentStatusSchema.parse({ status: 'completed' })).not.toThrow();
  });

  it('accepts status with completedAt', () => {
    const data = { status: 'completed', completedAt: '2026-09-10T12:00:00.000Z' };
    expect(() => updateDeploymentStatusSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => updateDeploymentStatusSchema.parse({ status: 'unknown' })).toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() =>
      updateDeploymentStatusSchema.parse({ status: 'completed', extra: true })
    ).toThrow();
  });
});
