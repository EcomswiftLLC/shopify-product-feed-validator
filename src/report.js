'use strict';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function describe(issue) {
  const where = issue.row === null ? 'header' : `row ${issue.row} (${issue.id})`;
  const field = issue.field ? ` ${issue.field}` : '';
  return `  ${where}${field}: ${issue.message} [${issue.code}]`;
}

function formatText(result, fileName, { maxIssues = 50 } = {}) {
  const { issues, summary } = result;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const lines = [
    `${fileName}: ${plural(summary.products, 'product')} checked`,
    `${plural(summary.errors, 'error')}, ${plural(summary.warnings, 'warning')}`,
    summary.passed
      ? 'PASSED: no errors found.'
      : 'FAILED: fix the errors before uploading this feed to Merchant Center.',
  ];

  let shown = 0;
  const section = (title, list) => {
    if (list.length === 0) return;
    lines.push('', title);
    for (const issue of list) {
      if (shown >= maxIssues) return;
      lines.push(describe(issue));
      shown++;
    }
  };
  section('ERRORS', errors);
  section('WARNINGS', warnings);

  if (issues.length > shown) {
    lines.push('', `... ${issues.length - shown} more. Run with --json to see every issue.`);
  }
  return lines.join('\n');
}

module.exports = { formatText };
