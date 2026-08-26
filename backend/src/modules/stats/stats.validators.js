const { z } = require('zod');

const windowSchema = z.enum(['24h', '7d', '30d', '90d']).default('24h');

function parseWindowQuery(rawWindow) {
  if (rawWindow === undefined || rawWindow === null || rawWindow === '') {
    return { success: true, data: '24h' };
  }
  return windowSchema.safeParse(rawWindow);
}

module.exports = { windowSchema, parseWindowQuery };
