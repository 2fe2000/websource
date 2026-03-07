# Source Config Specification

## Overview

An extraction config defines how to extract structured data from a web page. Configs are generated automatically during `websource init` and stored in SQLite, but are designed to be human-readable and editable.

## Schema

```typescript
interface ExtractionConfig {
  id: string;                    // Auto-generated unique ID
  sourceId: string;              // Parent source ID
  version: number;               // Config version (incremented on edit)
  fetchMode: 'static' | 'rendered';  // How to fetch pages

  listSelector: string;          // CSS selector matching each repeated item
  fields: Field[];               // Fields to extract per item

  pagination?: PaginationConfig; // How to navigate pages
  detailPage?: DetailPageConfig; // Follow links to detail pages

  rateLimitMs: number;           // Minimum ms between requests
  timeoutMs: number;             // Request timeout
  maxRetries: number;            // Retry count on failure
  robotsPolicy: 'respect' | 'ignore';
  userAgent?: string;
}
```

## Field Definition

```typescript
interface Field {
  name: string;           // Field name in output records
  selector: string;       // CSS selector (relative to list item)
  fallbackSelectors?: string[];  // Tried in order if primary fails
  attribute?: string;     // HTML attribute to extract (default: textContent)
  type: FieldType;        // string | number | url | date | image | price | boolean | html
  transform?: TransformPipe[];   // Post-extraction transforms
  required: boolean;      // If true, missing = lower confidence
  fromDetailPage?: boolean;  // Extract from detail page instead of list
}
```

## Supported Field Types

| Type | Description | Auto-normalization |
|---|---|---|
| `string` | Plain text | Whitespace collapse |
| `number` | Numeric value | Parse from text, handle commas |
| `url` | Link URL | Resolve relative to absolute |
| `date` | Date/time | Parse ISO, US, European, relative formats |
| `image` | Image URL | Resolve URL, handle srcset/data-src |
| `price` | Price with currency | Extract amount + currency symbol |
| `boolean` | True/false | Recognize "yes", "in stock", "available", etc. |
| `html` | Raw HTML | No normalization |

## Transform Pipeline

Transforms are applied in order after extraction:

| Transform | Description |
|---|---|
| `trim` | Strip whitespace |
| `lowercase` | Convert to lowercase |
| `collapseWhitespace` | Replace multiple spaces with one |
| `stripHtml` | Remove HTML tags |
| `regex` | Apply regex, extract group |
| `replace` | String replacement |
| `prefix` | Prepend a string |
| `parseNumber` | Parse numeric value |
| `parsePrice` | Parse price (amount + currency) |
| `parseDate` | Parse date to ISO format |
| `resolveUrl` | Resolve relative URL |
| `parseBoolean` | Parse boolean value |

## Pagination Config

```typescript
interface PaginationConfig {
  strategy: 'next-link' | 'page-param' | 'offset-param' | 'infinite-scroll';
  nextSelector?: string;    // CSS selector for "next" link
  paramName?: string;       // URL parameter name (e.g., "page")
  startValue?: number;      // First page value
  increment?: number;       // Page number increment
  maxPages: number;         // Safety cap
}
```

## Detail Page Config

```typescript
interface DetailPageConfig {
  linkSelector: string;     // Selector for the detail link within each item
  linkAttribute?: string;   // Default: "href"
  fields: Field[];          // Fields to extract from detail page
  fetchMode?: 'static' | 'rendered';
  rateLimitMs?: number;     // Rate limit for detail page requests
}
```
