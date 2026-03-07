import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { Source } from '../../shared/types.js';

function rowToSource(row: any): Source {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSource(data: { name: string; url: string; description?: string }): Source {
  const db = getDb();
  const id = generateId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO sources (id, name, url, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  ).run(id, data.name, data.url, data.description ?? null, now, now);

  return { id, ...data, status: 'active', createdAt: now, updatedAt: now };
}

export function getSource(id: string): Source | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as any;
  return row ? rowToSource(row) : undefined;
}

export function listSources(status?: string): Source[] {
  const db = getDb();
  if (status) {
    return (db.prepare('SELECT * FROM sources WHERE status = ? ORDER BY created_at DESC').all(status) as any[]).map(rowToSource);
  }
  return (db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all() as any[]).map(rowToSource);
}

export function updateSource(id: string, data: Partial<Pick<Source, 'name' | 'description' | 'status'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }

  sets.push('updated_at = ?');
  values.push(nowISO());
  values.push(id);

  db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteSource(id: string): void {
  getDb().prepare('DELETE FROM sources WHERE id = ?').run(id);
}
