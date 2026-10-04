'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed } = require('../src/parse');

test('parses a TSV feed with CRLF line endings and a UTF-8 BOM', () => {
  const text = '﻿id\ttitle\tprice\r\nA1\tMug\t9.00 USD\r\nA2\tPlate\t12.00 USD\r\n';
  const feed = parseFeed(text, 'feed.tsv');
  assert.equal(feed.delimiter, '\t');
  assert.deepEqual(feed.headers, ['id', 'title', 'price']);
  assert.equal(feed.rows.length, 2);
  assert.deepEqual(feed.rows[1], { row: 2, values: ['A2', 'Plate', '12.00 USD'] });
});

test('keeps quotes literal in TSV because the Google TSV format has no quoting', () => {
  const feed = parseFeed('id\ttitle\nA1\t"Quoted" title\n', 'feed.tsv');
  assert.equal(feed.rows[0].values[1], '"Quoted" title');
});

test('parses CSV fields with commas, quotes and newlines', () => {
  const text = 'id,title,description\nA1,"Mug, large","Says ""hello""\nin two lines"\n';
  const feed = parseFeed(text, 'feed.csv');
  assert.deepEqual(feed.rows[0].values, ['A1', 'Mug, large', 'Says "hello"\nin two lines']);
});

test('skips blank lines between records', () => {
  const feed = parseFeed('id\ttitle\n\nA1\tMug\n\n', 'feed.tsv');
  assert.equal(feed.rows.length, 1);
});

test('sniffs the delimiter when the file extension is unknown', () => {
  const feed = parseFeed('id,title\nA1,Mug\n', 'feed.dat');
  assert.equal(feed.delimiter, ',');
});

test('throws on an empty file', () => {
  assert.throws(() => parseFeed('\n  \n', 'feed.tsv'), /the feed is empty/);
});

test('throws when a quoted CSV field never closes', () => {
  assert.throws(() => parseFeed('id,title\nA1,"Mug\n', 'feed.csv'), /quoted field/);
});
