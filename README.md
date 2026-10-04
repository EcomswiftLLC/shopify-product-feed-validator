# shopify-product-feed-validator

Checks a Google Merchant Center product feed for the errors that get products rejected, before you upload it.

Shopify stores feed Google Shopping from a product file, and one bad price, a missing id, or a malformed GTIN can quietly knock products out of the results. `spv` reads the feed on your machine and reports every problem with the product row and the attribute it came from. It uses only Node.js, with no dependencies, and it never sends your data anywhere.

> Want a check of the whole store, not just the feed? [Run the free store audit](https://audit.ecomswiftllc.com/?utm_source=github&utm_medium=repo&utm_campaign=shopify-product-feed-validator). It covers SEO, speed, conversion and AI visibility in one report.

```
$ spv examples/products-with-errors.tsv
products-with-errors.tsv: 3 products checked
9 errors, 4 warnings
FAILED: fix the errors before uploading this feed to Merchant Center.

ERRORS
  row 1 (SKU-2001) price: price "31,50 USD" must be a number and a three-letter currency code, like "19.99 USD". [price-format]
  row 1 (SKU-2001) availability: availability "in stock" must be one of: in_stock, out_of_stock, preorder, backorder. [availability-invalid]
  row 1 (SKU-2001) gtin: gtin "4006381333932" is not valid. It must be 8, 12, 13 or 14 digits with a correct check digit. [gtin-invalid]
  row 2 (SKU-2001) id: id "SKU-2001" is also used in row 1. Each product needs its own id. [duplicate-id]
  row 2 (SKU-2001) image_link: image_link "cdn.example.com/socks.jpg" is not an absolute http(s) URL. [invalid-url]
  row 2 (SKU-2001) condition: condition "brand-new" must be one of: new, refurbished, used. [condition-invalid]
  row 3 (SKU-2003) description: "description" is empty. [empty-required]
  row 3 (SKU-2003) price: price "58.00" must be a number and a three-letter currency code, like "19.99 USD". [price-format]
  row 3 (SKU-2003) gtin: gtin "123" is not valid. It must be 8, 12, 13 or 14 digits with a correct check digit. [gtin-invalid]

WARNINGS
  row 1 (SKU-2001) title: title is all capitals. Use normal capitalization so it reads well in search results. [title-all-caps]
  row 2 (SKU-2001) link: link uses http://. Use https:// so the product page is served securely. [link-not-https]
  row 2 (SKU-2001) sale_price: sale_price 30.00 USD is not lower than price 24.00 USD. [sale-price-not-lower]
  row 2 (SKU-2001) brand: brand is empty. Google asks for it on most products. [brand-missing]
```

Feed errors like these usually come from the product data behind the feed. If you want to see how the store's product pages and titles hold up, the [free store audit](https://audit.ecomswiftllc.com/?utm_source=github&utm_medium=repo&utm_campaign=shopify-product-feed-validator) checks them alongside speed and SEO.

## Features

- **Required attributes:** `id`, `title`, `description`, `link`, `image_link`, `price` and `availability` must be present and filled in.
- **Field limits:** `id` up to 50 characters, `title` up to 150, `description` up to 5,000, `image_link` up to 2,000.
- **Formats:** prices need a number and a three-letter currency code (`19.99 USD`). URLs must be absolute `http(s)`.
- **Enums:** `availability` must be `in_stock`, `out_of_stock`, `preorder` or `backorder`. `condition` must be `new`, `refurbished` or `used`.
- **GTIN check:** validates length and the GS1 check digit for GTIN-8, 12, 13 and 14.
- **Duplicates:** flags an `id` that appears twice and points to the first row.
- **Both formats:** reads tab-delimited (`.tsv`, `.txt`) and comma-delimited (`.csv`) files, with BOM and CRLF handled.
- **CI-friendly:** exit codes, `--strict` to fail on warnings, and `--json` for machine-readable output.

## Installation

You need Node.js 18 or newer. There are no packages to install.

```bash
git clone https://github.com/EcomswiftLLC/shopify-product-feed-validator.git
cd shopify-product-feed-validator
node bin/spv.js examples/products-good.tsv
```

To put `spv` on your PATH, run `npm link` inside the folder.

## Usage

```bash
spv products.tsv                 # text report, exit 1 if there are errors
spv products.csv --strict        # also exit 1 on warnings
spv products.tsv --json > report.json
spv products.tsv --max-issues 200
```

Row numbers count product rows from 1, so the first product under the header is row 1.

Exit codes: `0` no errors, `1` errors found (or warnings with `--strict`), `2` the file could not be read or parsed.

### Getting a feed from Shopify

Shopify's product CSV export uses different column names from Google's feed. Map the columns (`Handle` or `Variant SKU` to `id`, `Variant Price` to `price`, and so on), write out a tab-delimited file, then run `spv` on it. The validator checks the file you produce, not the Shopify export itself.

## Rules

| Code | Severity | What it means |
| --- | --- | --- |
| `missing-column` | error (warning for `brand`, `gtin`) | A required or recommended column is not in the header |
| `empty-required` | error | A required attribute is empty |
| `duplicate-id` | error | Two products share the same `id` |
| `id-too-long` / `title-too-long` / `description-too-long` / `image-link-too-long` | error | Over Google's length limit |
| `invalid-url` | error | `link` or `image_link` is not an absolute http(s) URL |
| `price-format` | error | Price or sale price is not `number CURRENCY` |
| `availability-invalid` / `condition-invalid` | error | Value is outside Google's list |
| `gtin-invalid` | error | GTIN has the wrong length or check digit |
| `column-count` | error | The row has a different number of fields than the header, often a stray tab |
| `link-not-https` | warning | Product link uses `http://` |
| `title-all-caps` | warning | Title is all capitals |
| `price-zero` | warning | Price is `0` |
| `sale-price-not-lower` | warning | Sale price is not below the regular price |
| `brand-missing` / `gtin-missing` | warning | Recommended attribute is empty |

## What it does NOT do

- It does **not** fetch your URLs or images. It cannot tell you whether a page exists, loads, or matches the product.
- It does **not** check image quality, size, or background requirements.
- It does **not** check category-specific attributes such as apparel size, color, age group, or gender.
- It does **not** check policy compliance: prohibited products, misleading claims, or restricted categories.
- It does **not** confirm that a GTIN is registered or belongs to the product.
- It does **not** read XML feeds or call the Merchant Center API.
- It is **not** a replacement for Merchant Center diagnostics. Google's own checks are the final word, so run this before upload and then check the diagnostics page.

## FAQ

**Does my data leave my machine?** No. `spv` reads the file you pass it and writes a report to your terminal. It makes no network requests.

**Why does a feed pass here but still show errors in Merchant Center?** Merchant Center checks things this tool does not, such as whether URLs load, images meet requirements, and category rules apply. Treat a clean run as "the file is well formed," not as "Google will approve every product."

**Is `--strict` a good default for CI?** Often yes. Warnings are about quality, and a feed that fails on them can catch regressions early. Start without `--strict` if your feed already has many warnings.

**Can I add my own rules?** Yes. Each check lives in `src/validate.js`. Add a check, add a test in `test/validate.test.js`, and open a pull request.

## Need a hand with your store?

If your feed is rejected and you want a person to look at it, or you want the whole store reviewed, [book the free audit](https://audit.ecomswiftllc.com/?utm_source=github&utm_medium=repo&utm_campaign=shopify-product-feed-validator). It checks the store itself, which is where many feed problems start: product titles, pages, speed and structured data.

## Related Shopify tools

- [shopify-store-audit-toolkit](https://github.com/EcomswiftLLC/shopify-store-audit-toolkit): a CLI that checks a live store's on-page SEO, links, and performance signals
- [shopify-seo-checklist](https://github.com/EcomswiftLLC/shopify-seo-checklist): an interactive checklist for technical and product SEO
- [shopify-csv-product-fixer](https://github.com/Ecom-Swift-LLC/shopify-csv-product-fixer): cleans up Shopify product CSV imports
- [shopify-metafields-manager](https://github.com/Ecom-Swift-LLC/shopify-metafields-manager): lists, exports and bulk-imports metafields
- [shopify-bulk-operations-toolkit](https://github.com/Ecom-Swift-LLC/shopify-bulk-operations-toolkit): runs large Admin API jobs through the Bulk Operations API

## Contributing

Issues and pull requests are welcome, especially a report of a Merchant Center error this tool missed. Include a minimal feed row that reproduces it. Run the tests first:

```bash
npm test
```

## Roadmap

- XML feed support
- An optional `--fix` mode that normalizes prices and availability values, and writes a corrected copy
- Category-specific checks for apparel and other common verticals

## License

MIT. See [LICENSE](LICENSE).

## Need help?

This project is maintained by **Ecom Swift LLC**, a Shopify Partner.

- 🛍️ Shopify Partner Directory: https://www.shopify.com/partners/directory/partner/waowy
- ✉️ Email: support@ecomswiftllc.com
- 💬 WhatsApp: https://wa.me/16312511767

Ecom Swift LLC also builds and runs Shopify stores. Explore more free tools at [ecomswiftllc.com/free-tools](https://www.ecomswiftllc.com/free-tools), or visit [ecomswiftllc.com](https://www.ecomswiftllc.com).
