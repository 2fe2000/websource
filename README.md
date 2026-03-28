# websource

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Turn websites into reusable structured data sources — through conversation, not code.

websource is a local-first CLI tool that analyzes a URL, detects extractable
fields (title, price, image, date…), and generates a reusable extraction config
that runs on demand or on a schedule. All data stays on your machine in SQLite.

## Quick start

```bash
git clone https://github.com/2fe2000/websource.git
cd websource
npm install
npx playwright install chromium

# Interactive setup wizard
npx tsx bin/websource.ts init https://books.toscrape.com
```

## Commands

| Command | Description |
|---|---|
| `init [url]` | Guided setup for a new data source |
| `scan <url>` | Analyze a page without saving |
| `sources list` | List all sources |
| `sources show <id>` | Show source details |
| `preview <id>` | Dry-run extraction (no DB write) |
| `extract <id>` | Run extraction and save |
| `diff <id>` | Show changes since last run |
| `schedule <id> <expr>` | Set a cron refresh schedule |
| `serve` | Start local REST API + scheduler |
| `export <id>` | Export to JSON/CSV |
| `doctor` | Run health checks |

## Claude Code integration (optional)

If you use [Claude Code](https://github.com/anthropics/claude-code), websource
exposes a full **MCP server** so Claude can call extraction tools directly —
no bash commands needed.

### MCP server (project-level — automatic)

When you open this project in Claude Code, it automatically picks up `.mcp.json`
and connects to the websource MCP server. No extra setup required.

### MCP server (user-level — any directory)

Register once to use websource tools from any directory:

```bash
# The server must run from the websource project directory.
# Use bash -c with cd to ensure the correct working directory:
claude mcp add websource -s user -- bash -c "cd /absolute/path/to/websource && npx tsx bin/mcp-server.ts"
```

### Claude Code skill (interactive wizard)

Install the `/websource` slash command skill:

```bash
bash scripts/install-skill.sh
```

Then use `/websource` or paste a URL in any Claude Code chat to launch the
guided wizard: category discovery → field selection → schedule → source creation.

### Available MCP tools

| Tool | Description |
|---|---|
| `websource_discover_sections` | Detect category/tab structure on a page |
| `websource_analyze_page` | Detect fields, blocks, and pagination |
| `websource_create_source` | Create and persist a data source |
| `websource_preview_extraction` | Dry-run extraction (no DB write) |
| `websource_run_extraction` | Run extraction and save results |
| `websource_list_sources` | List all saved sources |

## Configuration

All config is optional. Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Description |
|---|---|---|
| `WEBSOURCE_DATA_DIR` | `~/.local/share/websource` | Database and log location |
| `WEBSOURCE_CONFIG_DIR` | `~/.config/websource` | Config file location |
| `LOG_LEVEL` | `warn` | `trace` / `debug` / `info` / `warn` / `error` |

## Data storage

All extracted data is stored locally in a single SQLite database:

```
~/.local/share/websource/
├── websource.db   ← all data
└── logs/          ← log files (production mode only)
```

| Table | Contents |
|---|---|
| `sources` | Source list (name, URL, status) |
| `extraction_configs` | Field selectors, fetchMode, and other settings |
| `runs` | Extraction run history (time, record counts, status) |
| `snapshots` | The actual extracted records |
| `diffs` | Added / changed / removed records between runs |
| `schedules` | Cron schedule settings |

**Export extracted data:**

```bash
# JSON
npx tsx bin/websource.ts export <sourceId> --format json

# CSV
npx tsx bin/websource.ts export <sourceId> --format csv

# REST API
npx tsx bin/websource.ts serve
# GET http://localhost:3847/sources/:id/data
```

**Change the storage location** — add to `.env`:

```
WEBSOURCE_DATA_DIR=/your/custom/path
```

## Architecture

- **Node.js + TypeScript** (ESM, strict)
- **Cheerio** for static HTML parsing, **Playwright** for JS-rendered pages
- **SQLite** (better-sqlite3) for all local persistence
- **Fastify** for the local REST API
- **node-cron** for scheduling

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [CLI Usage](docs/CLI_USAGE.md)
- [Source Config Spec](docs/SOURCE_CONFIG_SPEC.md)
- [Extraction Engine](docs/EXTRACTION_ENGINE.md)
- [Scheduling](docs/SCHEDULING.md)
- [Legal Guardrails](docs/LEGAL_GUARDRAILS.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
