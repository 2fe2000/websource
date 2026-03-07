import { getDb } from '../db.js';
import { generateId, nowISO } from '../../shared/utils.js';
import type { ExtractionConfig, Field, PaginationConfig, DetailPageConfig } from '../../shared/types.js';

function rowToConfig(row: any): ExtractionConfig {
  return {
    id: row.id,
    sourceId: row.source_id,
    version: row.version,
    fetchMode: row.fetch_mode,
    listSelector: row.list_selector,
    fields: JSON.parse(row.fields) as Field[],
    pagination: row.pagination ? JSON.parse(row.pagination) as PaginationConfig : undefined,
    detailPage: row.detail_page ? JSON.parse(row.detail_page) as DetailPageConfig : undefined,
    rateLimitMs: row.rate_limit_ms,
    timeoutMs: row.timeout_ms,
    maxRetries: row.max_retries,
    robotsPolicy: row.robots_policy,
    userAgent: row.user_agent ?? undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export function createConfig(data: Omit<ExtractionConfig, 'id' | 'createdAt'>): ExtractionConfig {
  const db = getDb();
  const id = generateId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO extraction_configs
     (id, source_id, version, fetch_mode, list_selector, fields, pagination, detail_page,
      rate_limit_ms, timeout_ms, max_retries, robots_policy, user_agent, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.sourceId, data.version, data.fetchMode, data.listSelector,
    JSON.stringify(data.fields),
    data.pagination ? JSON.stringify(data.pagination) : null,
    data.detailPage ? JSON.stringify(data.detailPage) : null,
    data.rateLimitMs, data.timeoutMs, data.maxRetries, data.robotsPolicy,
    data.userAgent ?? null, data.isActive ? 1 : 0, now,
  );

  return { ...data, id, createdAt: now };
}

export function getActiveConfig(sourceId: string): ExtractionConfig | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM extraction_configs WHERE source_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1',
  ).get(sourceId) as any;
  return row ? rowToConfig(row) : undefined;
}

export function getConfig(id: string): ExtractionConfig | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM extraction_configs WHERE id = ?').get(id) as any;
  return row ? rowToConfig(row) : undefined;
}

export function listConfigs(sourceId: string): ExtractionConfig[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM extraction_configs WHERE source_id = ? ORDER BY version DESC').all(sourceId) as any[]).map(rowToConfig);
}

export function deactivateConfigs(sourceId: string): void {
  getDb().prepare('UPDATE extraction_configs SET is_active = 0 WHERE source_id = ?').run(sourceId);
}
