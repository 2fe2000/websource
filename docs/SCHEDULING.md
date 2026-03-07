# Scheduling

## Overview

websource supports scheduled extraction runs via `node-cron`. The scheduler runs in-process with the `websource serve` command.

## Setting a Schedule

```bash
# Presets
websource schedule <sourceId> hourly    # 0 * * * *
websource schedule <sourceId> daily     # 0 0 * * *
websource schedule <sourceId> weekly    # 0 0 * * 0

# Custom cron expression
websource schedule <sourceId> "*/30 * * * *"  # Every 30 minutes
```

## Starting the Scheduler

```bash
# Start API server + scheduler
websource serve

# Scheduler only (no HTTP)
websource serve --scheduler-only
```

## How It Works

1. On startup, `Scheduler` loads all enabled schedules from the database
2. Each schedule creates a `node-cron` task
3. When a cron trigger fires, `ScheduledRunner` executes:
   - Acquires a file-based lock (prevents concurrent runs on same source)
   - Loads source + active config
   - Runs the full extraction pipeline
   - Computes diff against previous snapshot
   - Updates schedule's `lastRunAt` timestamp
   - Releases lock

## Concurrency Control

- File-based locks at `~/.local/share/websource/locks/<sourceId>.lock`
- Lock contains the PID of the holding process
- Stale locks (PID no longer running) are automatically cleaned up
- If lock cannot be acquired, the scheduled run is skipped

## Limitations

- Scheduler only runs while `websource serve` is running
- No built-in daemon/service installer (planned for future)
- No distributed locking (single-machine only)
