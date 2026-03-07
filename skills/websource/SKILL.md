---
name: websource
description: >
  Interactive wizard that turns any website into a structured data source.
  Given a URL, guides through category discovery → field analysis → field
  selection → schedule setup → source creation, all within the chat.
  Trigger on: "scrape this", "crawl this", "create a source", "I want to
  extract data", or when a URL is pasted. Use for web scraping, data
  collection, and recurring extraction automation.
triggers:
  - "websource"
  - "scrape this"
  - "crawl this"
  - "create a source"
  - "extract data"
---

# websource wizard

<!-- Replace the path below with the absolute path to your websource installation -->
PROJECT_DIR="/path/to/websource"

All scripts are run as:
```
cd "$PROJECT_DIR" && npx tsx scripts/<script>.ts <args>
```

---

## Wizard flow

When the user provides a URL, follow these steps in order.
Run the script for each step, then present the result and ask the user
before moving on.

---

### Step 0 — Section/category discovery

```bash
cd "$PROJECT_DIR" && npx tsx scripts/discover-sections.ts <URL> --mode rendered
```

**Interpreting the result:**
- `hasSections: true` → show the discovered sections as a numbered menu and ask the user to choose
  - Multiple selections allowed ("1,3,5" or "all")
  - Run Step 1 for each selected section URL
- `hasSections: false` → skip to Step 1 with the original URL

Example display:
```
Discovered categories:
1. Web Apps — https://example.com/leaderboard/webapps
2. Mobile   — https://example.com/leaderboard/mobile
3. Android  — https://example.com/leaderboard/android

Which categories would you like to extract? (enter numbers, multiple allowed: "1,3" or "all")
```

---

### Step 1 — Page analysis

Run for each selected URL:

```bash
cd "$PROJECT_DIR" && npx tsx scripts/analyze-page.ts <URL> --mode auto
```

**Interpreting the result:**
- `fieldQuality: "none"` or `"poor"` → retry with `--mode rendered`
- On success, display `suggestedFields` as a table

Example table:
```
Analysis complete: https://example.com/leaderboard/webapps

| # | Field      | Type   | Sample value   |
|---|------------|--------|----------------|
| 1 | model_name | text   | GPT-4o         |
| 2 | score      | number | 1337           |
| 3 | image      | image  | https://...    |
| 4 | url        | url    | https://...    |
```

If analyzing multiple URLs: analyze each one and merge the common fields.

---

### Step 2 — Field selection

After showing the analysis, ask:

```
Which fields would you like to extract? (enter numbers: "1,2,3" or "all")
```

Confirm the selected field list before moving on.

---

### Step 3 — Update schedule

```
How often should this source be refreshed?
1. Manual (only when I run it)
2. Every hour
3. Daily at midnight
4. Weekly on Sunday at midnight
```

Schedule values:
- 1 → `null`
- 2 → `"0 * * * *"`
- 3 → `"0 0 * * *"`
- 4 → `"0 0 * * 0"`

---

### Step 4 — Create source

Create one source per selected URL.

Source name is auto-generated: `<site name> <section name>` (e.g. "DesignArena Leaderboard WebApps")

```bash
cd "$PROJECT_DIR" && npx tsx scripts/create-source.ts '<JSON>'
```

JSON structure:
```json
{
  "name": "<source name>",
  "url": "<target URL>",
  "fetchMode": "auto",
  "listSelector": "<block.selector>",
  "fields": [
    { "name": "model_name", "selector": "...", "type": "text" },
    { "name": "score",      "selector": "...", "type": "number" }
  ],
  "schedule": "0 0 * * *"
}
```

`listSelector` and `fields[].selector` come from `suggestedBlock.selector` and `suggestedFields[].selector` in the analyze-page output.

---

### Step 5 — Preview and confirm

```bash
cd "$PROJECT_DIR" && npx tsx scripts/preview-extraction.ts <id> --limit 5
```

Display the preview as a table, then ask:

```
Ready to run the actual extraction and save to the database? (yes/no)
```

On "yes":
```bash
cd "$PROJECT_DIR" && npx tsx scripts/run-extraction.ts <id>
```

---

## Operations

### List sources
```bash
cd "$PROJECT_DIR" && npx tsx scripts/list-sources.ts
```

### Re-run extraction
```bash
cd "$PROJECT_DIR" && npx tsx scripts/run-extraction.ts <sourceId>
```

### Preview
```bash
cd "$PROJECT_DIR" && npx tsx scripts/preview-extraction.ts <sourceId> --limit 10
```

---

## Notes

- Script output is JSON — parse it and display it in a readable format for the user
- On error (`ok: false`) inform the user and suggest how to retry
- When multiple sections are selected, create a separate source for each (distinguished by name)
- If `fieldQuality` is low, automatically retry with `--mode rendered`
