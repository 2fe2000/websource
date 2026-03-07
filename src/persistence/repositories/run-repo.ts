import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { Run, RunStatus, ErrorClass } from '../../shared/types.js';

function rowToRun(row: any): Run {
  return {
    id: row.id,
    sourceId: row.source_id,
    configId: row.config_id,
    status: row.status,
    trigger: row.trigger_type,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    recordsTotal: row.records_total,
    recordsNew: row.records_new,
    recordsChanged: row.records_changed,
    recordsRemoved: row.records_removed,
    pagesFetched: row.pages_fetched,
    errorMessage: row.error_message ?? undefined,
    errorClass: row.error_class ?? undefined,
    createdAt: row.created_at,
  };
}

export function createRun(data: { sourceId: string; configId: string; trigger: Run['trigger'] }): Run {
  const db = getDb();
  const id = generateId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO runs (id, source_id, config_id, status, trigger_type, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
  ).run(id, data.sourceId, data.configId, data.trigger, now);

  return {
    id, sourceId: data.sourceId, configId: data.configId,
    status: 'pending', trigger: data.trigger,
    recordsTotal: 0, recordsNew: 0, recordsChanged: 0, recordsRemoved: 0,
    pagesFetched: 0, createdAt: now,
  };
}

export function updateRunStatus(id: string, status: RunStatus, extra?: {
  startedAt?: string; completedAt?: string;
  recordsTotal?: number; recordsNew?: number; recordsChanged?: number; recordsRemoved?: number;
  pagesFetched?: number; errorMessage?: string; errorClass?: ErrorClass;
}): void {
  const db = getDb();
  const sets = ['status = ?'];
  const values: any[] = [status];

  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val === undefined) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }

  values.push(id);
  db.prepare(`UPDATE runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getRun(id: string): Run | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any;
  return row ? rowToRun(row) : undefined;
}

export function listRuns(sourceId: string, limit = 20): Run[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM runs WHERE source_id = ? ORDER BY created_at DESC LIMIT ?').all(sourceId, limit) as any[]).map(rowToRun);
}

export function getLatestRun(sourceId: string): Run | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM runs WHERE source_id = ? ORDER BY created_at DESC LIMIT 1').get(sourceId) as any;
  return row ? rowToRun(row) : undefined;
}
