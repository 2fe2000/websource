# Extraction Engine

## Pipeline Stages

### 1. Fetch
- **Static**: HTTP fetch via Node.js `fetch()` with retry and timeout
- **Rendered**: Playwright Chromium with `networkidle` wait strategy
- **Auto**: Try static first; fall back to rendered if page looks JS-dependent (empty body, SPA markers)

### 2. Parse
Load HTML into Cheerio for fast DOM querying.

### 3. Select Items
Apply `listSelector` to find all repeated items on the page. Each matching element becomes one record.

### 4. Extract Fields
For each item element, apply each field's CSS selector:
- Try primary selector first
- If no match, try `fallbackSelectors` in order
- Extract `textContent` or specified `attribute`
- Track whether fallback was used (affects confidence)

### 5. Detail Page Traversal (optional)
For each record that has a URL field:
- Rate-limited fetch of the detail page
- Extract `detailPage.fields` from the detail page
- Merge detail fields into the record

### 6. Pagination (optional)
After extracting all items from the current page:
- Resolve the next page URL using the configured strategy
- Loop back to Fetch stage
- Stop when `maxPages` reached or no next page found

### 7. Normalize
Apply type-based normalization:
- URLs: resolve relative to absolute
- Prices: parse currency symbol and amount
- Dates: parse multiple formats (ISO, US, European, relative)
- Numbers: handle commas, currency symbols
- Text: collapse whitespace

### 8. Validate
- Compute per-record confidence: `(filled fields / total fields)` with penalties for missing required fields and fallback usage
- Assess extraction health: item count, required field coverage, value uniformity detection

### 9. Deduplicate
- Hash records by key fields (required fields, or all fields if none are required)
- Remove duplicates within the run

### 10. Store
- Persist all records as a snapshot (JSON blob in SQLite)
- Compute content hash for change detection
- Update run record with final statistics

### 11. Diff
- Compare new snapshot against previous (if exists)
- Identify added, changed, and removed records by `_id`
- Field-level change tracking for changed records
- Persist diff result

## Confidence Scoring

Each record gets a confidence score (0.0 to 1.0):

| Factor | Impact |
|---|---|
| Missing required field | -0.30 per field |
| Missing optional field | -0.05 per field |
| Used fallback selector | -0.05 per field |

## Health Assessment

The extraction health check catches:
- **Low item count**: Fewer items than expected
- **Missing required fields**: < 80% coverage
- **Value uniformity**: All items have identical value for a field (broken selector)
- **High error rate**: > 30% of items had extraction errors

## Error Classification

| Class | Description |
|---|---|
| `network` | Connection failure, HTTP errors |
| `timeout` | Request or page load timeout |
| `parse` | HTML parsing failure |
| `selector` | CSS selector returned zero matches |
| `validation` | Record failed validation |
| `robots` | Blocked by robots.txt |
