'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed } = require('../src/parse');
const { validateFeed, isGtinValid } = require('../src/validate');

const HEADER = 'id\ttitle\tdescription\tlink\timage_link\tprice\tavailability\tbrand\tgtin\tcondition\tsale_price';
const GOOD = 'A1\tMerino Socks\tSoft socks.\thttps://shop.example.com/p/socks\thttps://cdn.example.com/socks.jpg\t24.00 USD\tin_stock\tExample Co\t0012345678905\tnew\t19.99 USD';

const run = (...rows) => validateFeed(parseFeed([HEADER, ...rows].join('\n'), 'feed.tsv'));
const codes = (result, severity = 'error') => result.issues.filter((i) => i.severity === severity).map((i) => i.code);

test('a complete, valid product passes with no issues', () => {
  const result = run(GOOD);
  assert.equal(result.summary.passed, true);
  assert.deepEqual(result.issues, []);
});

test('isGtinValid checks length and the GS1 check digit', () => {
  assert.equal(isGtinValid('4006381333931'), true);
  assert.equal(isGtinValid('0012345678905'), true);
  assert.equal(isGtinValid('4006381333932'), false);
  assert.equal(isGtinValid('123'), false);
  assert.equal(isGtinValid('40063813339A1'), false);
});

test('reports a missing required column', () => {
  const feed = parseFeed('id\ttitle\nA1\tMug\n', 'feed.tsv');
  const result = validateFeed(feed);
  assert.ok(codes(result).includes('missing-column'));
  assert.equal(result.summary.passed, false);
});

test('reports an empty required value', () => {
  const result = run(GOOD.replace('Soft socks.', ''));
  assert.deepEqual(codes(result), ['empty-required']);
});

test('reports a duplicate id on the second occurrence', () => {
  const result = run(GOOD, GOOD);
  const duplicate = result.issues.find((i) => i.code === 'duplicate-id');
  assert.equal(duplicate.row, 2);
  assert.match(duplicate.message, /row 1/);
});

test('enforces the title and description length limits', () => {
  const longTitle = 'T'.repeat(151).replace(/T/g, 'a');
  const longDescription = 'd'.repeat(5001);
  const result = run(GOOD.replace('Merino Socks', longTitle).replace('Soft socks.', longDescription));
  assert.deepEqual(codes(result).sort(), ['description-too-long', 'title-too-long']);
});

test('rejects prices without a currency code or with a comma decimal', () => {
  assert.deepEqual(codes(run(GOOD.replace('24.00 USD', '24,00 USD'))), ['price-format']);
  assert.deepEqual(codes(run(GOOD.replace('24.00 USD', '24.00'))), ['price-format']);
});

test('rejects an availability value outside the Google enum', () => {
  assert.deepEqual(codes(run(GOOD.replace('in_stock', 'in stock'))), ['availability-invalid']);
});

test('rejects a condition outside new, refurbished and used', () => {
  assert.deepEqual(codes(run(GOOD.replace('\tnew\t', '\tbrand-new\t'))), ['condition-invalid']);
});

test('rejects relative image and product URLs', () => {
  const result = run(GOOD.replace('https://cdn.example.com/socks.jpg', 'cdn.example.com/socks.jpg'));
  assert.deepEqual(codes(result), ['invalid-url']);
  assert.equal(result.issues[0].field, 'image_link');
});

test('rejects an invalid GTIN but warns when it is simply empty', () => {
  assert.deepEqual(codes(run(GOOD.replace('0012345678905', '123'))), ['gtin-invalid']);
  assert.deepEqual(codes(run(GOOD.replace('0012345678905', '')), 'warning'), ['gtin-missing']);
});

test('warns on an all-caps title, http links, zero prices and sale prices that are not lower', () => {
  const result = run(GOOD.replace('Merino Socks', 'MERINO SOCKS')
    .replace('https://shop.example.com', 'http://shop.example.com')
    .replace('24.00 USD', '0.00 USD')
    .replace('19.99 USD', '30.00 USD'));
  assert.deepEqual(codes(result), []);
  assert.deepEqual(codes(result, 'warning').sort(), ['link-not-https', 'price-zero', 'sale-price-not-lower', 'title-all-caps'].sort());
});

test('flags a row whose field count does not match the header', () => {
  const result = run(GOOD.split('\t').slice(0, 10).join('\t'));
  assert.ok(codes(result).includes('column-count'));
});

test('a warning alone does not fail the summary', () => {
  const result = run(GOOD.replace('0012345678905', ''));
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 1);
  assert.equal(result.summary.passed, true);
});

test('counts products that have at least one error', () => {
  const result = run(GOOD, GOOD.replace('in_stock', 'maybe').replace('A1', 'A2'));
  assert.equal(result.summary.products, 2);
  assert.equal(result.summary.productsWithErrors, 1);
});
