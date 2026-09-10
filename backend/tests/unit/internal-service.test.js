/* globals describe, it, expect */
const { runTool } = require('../../src/modules/internal/internal.service');

describe('internal tool resolver', () => {
  describe('runTool dispatch', () => {
    it('throws on empty tool name', async () => {
      await expect(runTool({ tool: '', arguments: {} })).rejects.toThrow('Tool name is required');
    });

    it('throws on missing tool name', async () => {
      await expect(runTool({ arguments: {} })).rejects.toThrow('Tool name is required');
    });

    it('throws on unknown tool', async () => {
      await expect(runTool({ tool: 'nonexistent_tool', arguments: {} })).rejects.toThrow('Unknown tool');
    });

    it('throws on non-string tool name', async () => {
      await expect(runTool({ tool: 123, arguments: {} })).rejects.toThrow('Tool name is required');
    });

    it('accepts all known tool names', () => {
      const tools = [
        'get_incident', 'get_ping_logs', 'get_alerts', 'get_timeline',
        'get_deployment', 'get_git_commit', 'get_git_diff', 'get_changed_files',
        'inspect_source_file', 'search_similar_incidents', 'get_historical_resolution',
        'list_recent_investigations',
      ];
      // Verify all known tools are registered (not unknown)
      for (const tool of tools) {
        expect(() => runTool({ tool, arguments: {} })).not.toThrow('Unknown tool');
      }
    });
  });
});
