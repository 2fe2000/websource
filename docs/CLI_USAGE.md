# CLI Usage

## Installation

```bash
npm install
npm run build
# Or use directly with tsx:
npx tsx bin/websource.ts <command>
```

## Commands

### `websource init [url]`

Guided conversational setup to create a new data source. Analyzes the URL, proposes extractable fields, and saves a reusable config.

```bash
websource init https://books.toscrape.com
```

### `websource scan <url>`

Analyze a website without creating a source. Shows page type, repeated blocks, suggested fields, pagination, and detail links.

```bash
websource scan https://example.com/products
websource scan https://example.com/jobs --rendered  # Force browser rendering
```

### `websource sources list`

List all registered sources.

```bash
websource sources list
websource sources list --status active
```

### `websource sources show <id>`

Show detailed info about a source: config, fields, schedule, recent runs.

```bash
websource sources show abc123
```

### `websource preview <sourceId>`

Dry-run extraction — fetches and extracts but does not save results.

```bash
websource preview abc123
websource preview abc123 --limit 5
```

### `websource extract <sourceId>`

Run extraction and save results. Automatically computes diff against the previous snapshot.

```bash
websource extract abc123
```

### `websource diff <sourceId>`

Show changes between the last two extractions.

```bash
websource diff abc123
websource diff abc123 --run-a <runId> --run-b <runId>  # Compare specific runs
```

### `websource schedule <sourceId> <expression>`

Set a refresh schedule. Supports presets (`hourly`, `daily`, `weekly`) or cron expressions.

```bash
websource schedule abc123 daily
websource schedule abc123 "0 */6 * * *"  # Every 6 hours
```

### `websource serve`

Start the local API server and scheduler.

```bash
websource serve
websource serve --port 4000
websource serve --scheduler-only  # No HTTP, just run scheduled extractions
```

### `websource export <sourceId>`

Export extracted data to JSON or CSV.

```bash
websource export abc123 --format json
websource export abc123 --format csv --output data.csv
websource export abc123 --run <runId>  # Export from a specific run
```

### `websource doctor`

Run diagnostics: check database, Playwright, source reachability, selector health.

```bash
websource doctor
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `WEBSOURCE_DATA_DIR` | Data directory (DB, logs, locks) | `~/.local/share/websource` |
| `WEBSOURCE_CONFIG_DIR` | Config directory | `~/.config/websource` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `NODE_ENV` | Set to `production` for file-based logging | — |
