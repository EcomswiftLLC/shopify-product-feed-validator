'use strict';

// Checks a parsed product feed against the attributes Google Merchant Center
// asks for most often. This is a subset of Google's full specification, and it
// only reads the file. It never fetches URLs or images.

const REQUIRED = ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability'];
const RECOMMENDED = ['brand', 'gtin'];
const AVAILABILITY = ['in_stock', 'out_of_stock', 'preorder', 'backorder'];
const CONDITION = ['new', 'refurbished', 'used'];
const PRICE_PATTERN = /^\d+(\.\d+)? [A-Z]{3}$/;
const LIMITS = { id: 50, title: 150, description: 5000, image_link: 2000 };

// GTIN-8, 12, 13 and 14 all use the GS1 check digit: weights 3 and 1 alternate,
// starting from the digit just left of the check digit.
function isGtinValid(value) {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isAllCaps(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function validateFeed({ headers, rows }) {
  const issues = [];
  const has = (name) => headers.includes(name);
  const seenIds = new Map();

  const push = (severity, code, row, id, field, message) => {
    issues.push({ severity, code, row, id, field, message });
  };

  for (const name of REQUIRED) {
    if (!has(name)) {
      push('error', 'missing-column', null, '', name, `Required column "${name}" is not in the header row.`);
    }
  }
  for (const name of RECOMMENDED) {
    if (!has(name)) {
      push('warning', 'missing-column', null, '', name, `Column "${name}" is not in the header row. Google asks for it on most products.`);
    }
  }

  for (const { row, values } of rows) {
    const get = (name) => (has(name) ? (values[headers.indexOf(name)] ?? '').trim() : '');
    const id = get('id');
    const label = id || '(no id)';
    const report = (severity, code, field, message) => push(severity, code, row, label, field, message);

    if (values.length !== headers.length) {
      report('error', 'column-count', '', `This row has ${values.length} fields, but the header has ${headers.length}. Look for a stray tab or comma.`);
    }

    for (const name of REQUIRED) {
      if (has(name) && get(name) === '') {
        report('error', 'empty-required', name, `"${name}" is empty.`);
      }
    }

    if (id) {
      if (id.length > LIMITS.id) {
        report('error', 'id-too-long', 'id', `id is ${id.length} characters. The limit is ${LIMITS.id}.`);
      }
      if (seenIds.has(id)) {
        report('error', 'duplicate-id', 'id', `id "${id}" is also used in row ${seenIds.get(id)}. Each product needs its own id.`);
      } else {
        seenIds.set(id, row);
      }
    }

    const title = get('title');
    if (title.length > LIMITS.title) {
      report('error', 'title-too-long', 'title', `title is ${title.length} characters. The limit is ${LIMITS.title}.`);
    }
    if (isAllCaps(title)) {
      report('warning', 'title-all-caps', 'title', 'title is all capitals. Use normal capitalization so it reads well in search results.');
    }

    const description = get('description');
    if (description.length > LIMITS.description) {
      report('error', 'description-too-long', 'description', `description is ${description.length} characters. The limit is ${LIMITS.description}.`);
    }

    const link = get('link');
    if (link && !isHttpUrl(link)) {
      report('error', 'invalid-url', 'link', `link "${link}" is not an absolute http(s) URL.`);
    } else if (link.startsWith('http://')) {
      report('warning', 'link-not-https', 'link', 'link uses http://. Use https:// so the product page is served securely.');
    }

    const imageLink = get('image_link');
    if (imageLink && !isHttpUrl(imageLink)) {
      report('error', 'invalid-url', 'image_link', `image_link "${imageLink}" is not an absolute http(s) URL.`);
    } else if (imageLink.length > LIMITS.image_link) {
      report('error', 'image-link-too-long', 'image_link', `image_link is ${imageLink.length} characters. The limit is ${LIMITS.image_link}.`);
    }

    const price = get('price');
    if (price && !PRICE_PATTERN.test(price)) {
      report('error', 'price-format', 'price', `price "${price}" must be a number and a three-letter currency code, like "19.99 USD".`);
    } else if (price && parseFloat(price) === 0) {
      report('warning', 'price-zero', 'price', 'price is 0. Check that this is intended.');
    }

    const salePrice = get('sale_price');
    if (salePrice) {
      if (!PRICE_PATTERN.test(salePrice)) {
        report('error', 'price-format', 'sale_price', `sale_price "${salePrice}" must be a number and a three-letter currency code, like "15.00 USD".`);
      } else if (PRICE_PATTERN.test(price) && salePrice.split(' ')[1] === price.split(' ')[1] && parseFloat(salePrice) >= parseFloat(price)) {
        report('warning', 'sale-price-not-lower', 'sale_price', `sale_price ${salePrice} is not lower than price ${price}.`);
      }
    }

    const availability = get('availability');
    if (availability && !AVAILABILITY.includes(availability)) {
      report('error', 'availability-invalid', 'availability', `availability "${availability}" must be one of: ${AVAILABILITY.join(', ')}.`);
    }

    const condition = get('condition');
    if (condition && !CONDITION.includes(condition)) {
      report('error', 'condition-invalid', 'condition', `condition "${condition}" must be one of: ${CONDITION.join(', ')}.`);
    }

    if (has('brand') && get('brand') === '') {
      report('warning', 'brand-missing', 'brand', 'brand is empty. Google asks for it on most products.');
    }

    const gtin = get('gtin');
    if (has('gtin')) {
      if (gtin === '') {
        report('warning', 'gtin-missing', 'gtin', 'gtin is empty. Add it if the manufacturer assigned one.');
      } else if (!isGtinValid(gtin)) {
        report('error', 'gtin-invalid', 'gtin', `gtin "${gtin}" is not valid. It must be 8, 12, 13 or 14 digits with a correct check digit.`);
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const productsWithErrors = new Set(errors.filter((issue) => issue.row !== null).map((issue) => issue.row));

  return {
    issues,
    summary: {
      products: rows.length,
      errors: errors.length,
      warnings: issues.length - errors.length,
      productsWithErrors: productsWithErrors.size,
      passed: errors.length === 0,
    },
  };
}

module.exports = { validateFeed, isGtinValid };
