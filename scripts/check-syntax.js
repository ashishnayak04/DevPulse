#!/usr/bin/env node
/*
 * Cheap syntax gate (no linter configured in the repo). Runs `node --check`
 * over every JS file in backend/src, backend/scripts, backend/tests and the
 * repo-root config files — catches syntax errors before CI/test time.
 * Usage: node scripts/check-syntax.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['backend/src', 'backend/scripts', 'backend/tests'];
const ROOT_FILES = ['package.json', 'ecosystem.config.js', 'render.yaml'];

function isJs(file) {
  return /\.js$/.test(file);
}

function collect() {
  const files = [];
  for (const rel of SCAN_DIRS) {
    const dir = path.join(ROOT, rel);
    (function walk(d) {
      for (const entry of fs.readdirSync(d)) {
        if (entry === 'node_modules') continue;
        const full = path.join(d, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (isJs(entry)) files.push(full);
      }
    })(dir);
  }
  return files;
}

const files = collect();
let failed = 0;

for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    failed += 1;
    console.error(`SYNTAX ERROR in ${path.relative(ROOT, file)}:\n${res.stderr}`);
  }
}

console.log(`check-syntax: ${files.length - failed}/${files.length} JS files OK`);
process.exit(failed > 0 ? 1 : 0);