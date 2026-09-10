/* globals describe, it, expect */
const { z } = require('zod');

const aiContextSchema = z.object({
  tool: z.string().min(1, 'tool is required').max(64, 'tool name too long'),
  arguments: z.record(z.unknown()).optional().default({}),
});

describe('aiContextSchema validation', () => {
  it('accepts valid tool call', () => {
    const result = aiContextSchema.parse({ tool: 'get_incident', arguments: { incidentId: 'inc-1' } });
    expect(result.tool).toBe('get_incident');
    expect(result.arguments.incidentId).toBe('inc-1');
  });

  it('accepts tool without arguments', () => {
    const result = aiContextSchema.parse({ tool: 'list_recent_investigations' });
    expect(result.tool).toBe('list_recent_investigations');
    expect(result.arguments).toEqual({});
  });

  it('rejects empty tool name', () => {
    expect(() => aiContextSchema.parse({ tool: '' })).toThrow('tool is required');
  });

  it('rejects missing tool', () => {
    expect(() => aiContextSchema.parse({})).toThrow();
  });

  it('rejects tool name longer than 64 chars', () => {
    expect(() => aiContextSchema.parse({ tool: 'a'.repeat(65) })).toThrow('tool name too long');
  });

  it('accepts tool name at exactly 64 chars', () => {
    const result = aiContextSchema.parse({ tool: 'a'.repeat(64) });
    expect(result.tool).toHaveLength(64);
  });

  it('defaults arguments to empty object', () => {
    const result = aiContextSchema.parse({ tool: 'get_incident' });
    expect(result.arguments).toEqual({});
  });

  it('accepts complex arguments', () => {
    const args = { incidentId: 'inc-1', limit: '100', filter: { status: 'open' } };
    const result = aiContextSchema.parse({ tool: 'get_ping_logs', arguments: args });
    expect(result.arguments.incidentId).toBe('inc-1');
    expect(result.arguments.filter.status).toBe('open');
  });

  it('accepts all known tool names', () => {
    const tools = [
      'get_incident', 'get_ping_logs', 'get_alerts', 'get_timeline',
      'get_deployment', 'get_git_commit', 'get_git_diff', 'get_changed_files',
      'inspect_source_file', 'search_similar_incidents', 'get_historical_resolution',
      'list_recent_investigations',
    ];
    for (const tool of tools) {
      expect(() => aiContextSchema.parse({ tool })).not.toThrow();
    }
  });
});
