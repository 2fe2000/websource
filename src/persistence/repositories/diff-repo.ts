import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { DiffResult, ExtractedRecord, ChangedRecord } from '../../shared/types.js';

function rowToDiff(row: any): DiffResult {
  return {
    id: row.id,
    sourceId: row.source_id,
    snapshotBefore: row.snapshot_before ?? undefined,
    snapshotAfter: row.snapshot_after,
    added: JSON.parse(row.added) as ExtractedRecord[],
    changed: JSON.parse(row.changed) as ChangedRecord[],
    removed: JSON.parse(row.removed) as ExtractedRecord[],
    summary: row.summary ?? '',
    createdAt: row.created_at,
  };
}

export function createDiff(data: {
  sourceId: string;
  snapshotBefore?: string;
  snapshotAfter: string;
  added: ExtractedRecord[];
  changed: ChangedRecord[];
  removed: ExtractedRecord[];
  summary: string;
}): DiffResult {
  const db = getDb();
  const id = generateId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO diffs (id, source_id, snapshot_before, snapshot_after, added, changed, removed, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.sourceId, data.snapshotBefore ?? null, data.snapshotAfter,
    JSON.stringify(data.added), JSON.stringify(data.changed), JSON.stringify(data.removed),
    data.summary, now,
  );

  return { id, ...data, createdAt: now };
}

export function getDiff(id: string): DiffResult | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM diffs WHERE id = ?').get(id) as any;
  return row ? rowToDiff(row) : undefined;
}

export function getLatestDiff(sourceId: string): DiffResult | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM diffs WHERE source_id = ? ORDER BY created_at DESC LIMIT 1').get(sourceId) as any;
  return row ? rowToDiff(row) : undefined;
}

export function listDiffs(sourceId: string, limit = 20): DiffResult[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM diffs WHERE source_id = ? ORDER BY created_at DESC LIMIT ?').all(sourceId, limit) as any[]).map(rowToDiff);
}
