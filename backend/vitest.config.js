const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    exclude: ['scripts/**', 'node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    reporters: ['verbose'],
    fileParallelism: false,
  },
});
