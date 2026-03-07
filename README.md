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

## Claude Code skill (optional)

If you use [Claude Code](https://github.com/anthropics/claude-code), you can
run the interactive wizard from any chat session with `/websource` or natural
language like "scrape this URL".

```bash
bash scripts/install-skill.sh
```

## Configuration

All config is optional. Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Description |
|---|---|---|
| `WEBSOURCE_DATA_DIR` | `~/.local/share/websource` | Database and log location |
| `WEBSOURCE_CONFIG_DIR` | `~/.config/websource` | Config file location |
| `LOG_LEVEL` | `warn` | `trace` / `debug` / `info` / `warn` / `error` |

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
