#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseFeed } = require('../src/parse');
const { validateFeed } = require('../src/validate');
const { formatText } = require('../src/report');

const USAGE = `Usage: spv <feed.tsv|feed.csv> [options]

Checks a Google Merchant Center product feed before you upload it.

Options:
  --json            print every issue as JSON
  --strict          exit with 1 on warnings too
  --max-issues N    limit the text report to N issues (default 50)
  -h, --help        show this help

Exit codes: 0 = no errors, 1 = errors found, 2 = usage or read/parse problem.`;

function usageError(message) {
  console.error(`spv: ${message}`);
  console.error(USAGE);
  return 2;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(USAGE);
    return args.length === 0 ? 2 : 0;
  }

  const flags = { json: false, strict: false, maxIssues: 50 };
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--max-issues') {
      flags.maxIssues = Number(args[++i]);
      if (!Number.isInteger(flags.maxIssues) || flags.maxIssues < 1) {
        return usageError('--max-issues needs a whole number, 1 or more.');
      }
    } else if (arg.startsWith('-')) return usageError(`unknown option ${arg}.`);
    else files.push(arg);
  }

  if (files.length !== 1) return usageError('pass exactly one feed file.');

  const file = files[0];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`spv: cannot read ${file}: ${error.message}`);
    return 2;
  }

  let feed;
  try {
    feed = parseFeed(text, file);
  } catch (error) {
    console.error(`spv: ${file} could not be parsed: ${error.message}`);
    return 2;
  }

  const result = validateFeed(feed);
  if (flags.json) {
    console.log(JSON.stringify({ file, ...result }, null, 2));
  } else {
    console.log(formatText(result, path.basename(file), { maxIssues: flags.maxIssues }));
  }

  const failed = result.summary.errors > 0 || (flags.strict && result.summary.warnings > 0);
  return failed ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = { main };
