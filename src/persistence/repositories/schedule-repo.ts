import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { Schedule } from '../../shared/types.js';

function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    sourceId: row.source_id,
    cronExpr: row.cron_expr,
    preset: row.preset ?? undefined,
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at ?? undefined,
    nextRunAt: row.next_run_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function upsertSchedule(data: {
  sourceId: string; cronExpr: string; preset?: string;
}): Schedule {
  const db = getDb();
  const existing = getScheduleBySource(data.sourceId);

  if (existing) {
    db.prepare(
      'UPDATE schedules SET cron_expr = ?, preset = ?, enabled = 1 WHERE source_id = ?',
    ).run(data.cronExpr, data.preset ?? null, data.sourceId);
    return { ...existing, cronExpr: data.cronExpr, preset: data.preset as Schedule['preset'], enabled: true };
  }

  const id = generateId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO schedules (id, source_id, cron_expr, preset, enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(id, data.sourceId, data.cronExpr, data.preset ?? null, now);

  return { id, sourceId: data.sourceId, cronExpr: data.cronExpr, preset: data.preset as Schedule['preset'], enabled: true, createdAt: now };
}

export function getScheduleBySource(sourceId: string): Schedule | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM schedules WHERE source_id = ?').get(sourceId) as any;
  return row ? rowToSchedule(row) : undefined;
}

export function listEnabledSchedules(): Schedule[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as any[]).map(rowToSchedule);
}

export function updateScheduleLastRun(sourceId: string, lastRunAt: string, nextRunAt?: string): void {
  getDb().prepare(
    'UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE source_id = ?',
  ).run(lastRunAt, nextRunAt ?? null, sourceId);
}

export function disableSchedule(sourceId: string): void {
  getDb().prepare('UPDATE schedules SET enabled = 0 WHERE source_id = ?').run(sourceId);
}
