import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r: any) => r.name),
  );

  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: '001-initial',
      sql: `
        CREATE TABLE sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE extraction_configs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          version INTEGER NOT NULL DEFAULT 1,
          fetch_mode TEXT NOT NULL DEFAULT 'static',
          list_selector TEXT NOT NULL,
          fields TEXT NOT NULL,
          pagination TEXT,
          detail_page TEXT,
          rate_limit_ms INTEGER NOT NULL DEFAULT 1000,
          timeout_ms INTEGER NOT NULL DEFAULT 30000,
          max_retries INTEGER NOT NULL DEFAULT 3,
          robots_policy TEXT NOT NULL DEFAULT 'respect',
          user_agent TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          config_id TEXT NOT NULL REFERENCES extraction_configs(id),
          status TEXT NOT NULL DEFAULT 'pending',
          trigger_type TEXT NOT NULL DEFAULT 'manual',
          started_at TEXT,
          completed_at TEXT,
          records_total INTEGER DEFAULT 0,
          records_new INTEGER DEFAULT 0,
          records_changed INTEGER DEFAULT 0,
          records_removed INTEGER DEFAULT 0,
          pages_fetched INTEGER DEFAULT 0,
          error_message TEXT,
          error_class TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE snapshots (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          records TEXT NOT NULL,
          record_count INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE diffs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          snapshot_before TEXT REFERENCES snapshots(id),
          snapshot_after TEXT NOT NULL REFERENCES snapshots(id),
          added TEXT NOT NULL DEFAULT '[]',
          changed TEXT NOT NULL DEFAULT '[]',
          removed TEXT NOT NULL DEFAULT '[]',
          summary TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE schedules (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
          cron_expr TEXT NOT NULL,
          preset TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          last_run_at TEXT,
          next_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_extraction_configs_source ON extraction_configs(source_id);
        CREATE INDEX idx_runs_source ON runs(source_id);
        CREATE INDEX idx_runs_status ON runs(status);
        CREATE INDEX idx_snapshots_source ON snapshots(source_id);
        CREATE INDEX idx_snapshots_run ON snapshots(run_id);
        CREATE INDEX idx_diffs_source ON diffs(source_id);
      `,
    },
  ];

  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.name);
    })();
  }
}
