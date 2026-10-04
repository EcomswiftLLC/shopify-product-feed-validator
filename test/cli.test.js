'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { main } = require('../bin/spv');

const EXAMPLES = path.join(__dirname, '..', 'examples');

// Runs the CLI with console output captured, so tests can read what it printed.
function runCli(args) {
  const out = [];
  const err = [];
  const log = console.log;
  const error = console.error;
  console.log = (...parts) => out.push(parts.join(' '));
  console.error = (...parts) => err.push(parts.join(' '));
  try {
    const code = main(['node', 'spv', ...args]);
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    console.log = log;
    console.error = error;
  }
}

test('exits 0 for the clean example feed', () => {
  const result = runCli([path.join(EXAMPLES, 'products-good.tsv')]);
  assert.equal(result.code, 0);
  assert.match(result.out, /PASSED/);
});

test('exits 1 for the example feed with errors', () => {
  const result = runCli([path.join(EXAMPLES, 'products-with-errors.tsv')]);
  assert.equal(result.code, 1);
  assert.match(result.out, /FAILED/);
  assert.match(result.out, /\[duplicate-id\]/);
});

test('--strict fails on warnings', () => {
  const file = path.join(EXAMPLES, 'products-good.tsv');
  assert.equal(runCli([file]).code, 0);
  assert.equal(runCli([file, '--strict']).code, 0);
});

test('--json prints machine-readable issues and a summary', () => {
  const result = runCli([path.join(EXAMPLES, 'products-with-errors.tsv'), '--json']);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.summary.passed, false);
  assert.ok(Array.isArray(parsed.issues));
  assert.ok(parsed.issues.every((issue) => issue.code && issue.severity));
});

test('--max-issues caps the text report and says how many were left out', () => {
  const result = runCli([path.join(EXAMPLES, 'products-with-errors.tsv'), '--max-issues', '2']);
  assert.match(result.out, /more\. Run with --json/);
});

test('exits 2 for a missing file, a bad option and a missing argument', () => {
  assert.equal(runCli([path.join(EXAMPLES, 'nope.tsv')]).code, 2);
  assert.equal(runCli([path.join(EXAMPLES, 'products-good.tsv'), '--bogus']).code, 2);
  assert.equal(runCli([]).code, 2);
  assert.match(runCli([path.join(EXAMPLES, 'products-good.tsv'), '--max-issues', '0']).err, /whole number/);
});
