# Architecture

## Overview

websource is a modular Node.js/TypeScript CLI application organized into distinct layers:

```
┌──────────────────────────────────────────┐
│              CLI Layer                    │
│  Commands | Prompts | Formatters         │
├──────────────────────────────────────────┤
│           Core Engines                   │
│  Analysis | Extraction | Diffing         │
├──────────────────────────────────────────┤
│         Support Services                 │
│  Scheduling | Server | Export            │
├──────────────────────────────────────────┤
│         Persistence Layer                │
│  SQLite | Repositories | Migrations      │
├──────────────────────────────────────────┤
│          Shared Layer                    │
│  Types | Errors | Logger | Utilities     │
└──────────────────────────────────────────┘
```

## Module Dependencies

Dependencies flow strictly downward. `shared/` and `config/` are leaf modules with no internal dependencies.

- **CLI** depends on Analysis, Extraction, Persistence, Diffing, Scheduling, Server, Export
- **Analysis** depends on Shared (retry, rate-limiter)
- **Extraction** depends on Analysis (fetcher), Persistence (storage), Shared
- **Diffing** depends on Persistence (snapshot-repo)
- **Scheduling** depends on Extraction, Persistence
- **Server** depends on Persistence, Extraction
- **Persistence** depends on Config (paths)

## Data Flow

### Extraction Pipeline
```
Fetch → Parse → Select Items → Extract Fields → Detail Pages → Paginate
  → Normalize → Validate → Deduplicate → Store Snapshot → Compute Diff
```

### Conversational Setup
```
URL Input → Analyze → Select Block → Propose Fields → Pick Fields
  → Detail Pages → Refresh Cadence → Name → Confirm → Save
```

## Storage

All state lives in a single SQLite database at `~/.local/share/websource/websource.db`. Tables:

- **sources** — registered data sources
- **extraction_configs** — how to extract data (selectors, fields, pagination)
- **runs** — extraction execution history
- **snapshots** — extracted data per run (records stored as JSON)
- **diffs** — change detection results
- **schedules** — cron-based refresh schedules

## Key Design Decisions

1. **SQLite over files**: Single file, atomic writes, queryable, easy backup
2. **Records as JSON blobs**: Schema varies per source; no need for relational querying of individual fields
3. **In-process scheduler**: Lives inside `serve` process to avoid daemon complexity
4. **Static-first fetching**: Cheerio by default, Playwright only when JS rendering is needed
5. **Confidence scores**: Every extraction carries a 0-1 confidence metric instead of binary pass/fail
6. **Structural DOM fingerprinting**: Tag sequence comparison (ignoring CSS classes) for resilient block detection
