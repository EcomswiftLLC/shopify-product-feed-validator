'use strict';

// Parses a product feed (TSV or CSV) into a header list and data rows.
// Handles a UTF-8 BOM and CRLF or LF line endings. CSV fields may be quoted,
// with embedded commas, newlines and doubled quotes. TSV fields are taken
// literally, because Google's tab-delimited format does not use quoting.

function sniffDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  return firstLine.includes('\t') ? '\t' : ',';
}

function delimiterFor(fileName, text) {
  const name = fileName.toLowerCase();
  if (name.endsWith('.tsv') || name.endsWith('.txt')) return '\t';
  if (name.endsWith('.csv')) return ',';
  return sniffDelimiter(text);
}

function splitRecords(text, delimiter) {
  const allowQuotes = delimiter === ',';
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (allowQuotes && ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error('the file ends inside a quoted field. Check for a missing closing quote.');
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

// Returns { delimiter, headers, rows } where each row is { row, values }.
// `row` counts product rows from 1, so the first product under the header is row 1.
function parseFeed(text, fileName = 'feed.tsv') {
  const body = text.replace(/^﻿/, '');
  const delimiter = delimiterFor(fileName, body);
  const records = splitRecords(body, delimiter)
    .filter((record) => !(record.length === 1 && record[0].trim() === ''));

  if (records.length === 0) {
    throw new Error('the feed is empty.');
  }

  const headers = records[0].map((name) => name.trim().toLowerCase());
  const rows = records.slice(1).map((values, index) => ({ row: index + 1, values }));
  return { delimiter, headers, rows };
}

module.exports = { parseFeed, splitRecords, sniffDelimiter };
