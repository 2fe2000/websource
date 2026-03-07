import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { Snapshot, ExtractedRecord } from '../../shared/types.js';

function rowToSnapshot(row: any): Snapshot {
  return {
    id: row.id,
    runId: row.run_id,
    sourceId: row.source_id,
    records: JSON.parse(row.records) as ExtractedRecord[],
    recordCount: row.record_count,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}

export function createSnapshot(data: {
  runId: string; sourceId: string; records: ExtractedRecord[]; contentHash: string;
}): Snapshot {
  const db = getDb();
  const id = generateId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO snapshots (id, run_id, source_id, records, record_count, content_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.runId, data.sourceId, JSON.stringify(data.records), data.records.length, data.contentHash, now);

  return { id, ...data, recordCount: data.records.length, createdAt: now };
}

export function getSnapshot(id: string): Snapshot | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as any;
  return row ? rowToSnapshot(row) : undefined;
}

export function getSnapshotByRun(runId: string): Snapshot | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM snapshots WHERE run_id = ?').get(runId) as any;
  return row ? rowToSnapshot(row) : undefined;
}

export function getLatestSnapshot(sourceId: string): Snapshot | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM snapshots WHERE source_id = ? ORDER BY created_at DESC LIMIT 1').get(sourceId) as any;
  return row ? rowToSnapshot(row) : undefined;
}

export function listSnapshots(sourceId: string, limit = 20): Snapshot[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM snapshots WHERE source_id = ? ORDER BY created_at DESC LIMIT ?').all(sourceId, limit) as any[]).map(rowToSnapshot);
}
