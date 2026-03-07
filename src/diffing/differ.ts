import type { ExtractedRecord, DiffResult, ChangedRecord } from '../shared/types.js';
import { generateId, nowISO } from '../shared/utils.js';

export function computeDiff(
  sourceId: string,
  beforeSnapshotId: string | undefined,
  afterSnapshotId: string,
  before: ExtractedRecord[],
  after: ExtractedRecord[],
): DiffResult {
  const beforeMap = new Map(before.map((r) => [r._id, r]));
  const afterMap = new Map(after.map((r) => [r._id, r]));

  const added: ExtractedRecord[] = [];
  const changed: ChangedRecord[] = [];
  const removed: ExtractedRecord[] = [];

  // Find added and changed
  for (const [id, afterRec] of afterMap) {
    const beforeRec = beforeMap.get(id);
    if (!beforeRec) {
      added.push(afterRec);
      continue;
    }

    // Check for changes (compare non-meta fields)
    const changedFields: string[] = [];
    const beforeData: Record<string, unknown> = {};
    const afterData: Record<string, unknown> = {};

    for (const key of Object.keys(afterRec)) {
      if (key.startsWith('_')) continue;
      const bVal = JSON.stringify(beforeRec[key] ?? null);
      const aVal = JSON.stringify(afterRec[key] ?? null);
      if (bVal !== aVal) {
        changedFields.push(key);
        beforeData[key] = beforeRec[key];
        afterData[key] = afterRec[key];
      }
    }

    if (changedFields.length > 0) {
      changed.push({ recordId: id, before: beforeData, after: afterData, changedFields });
    }
  }

  // Find removed
  for (const [id, beforeRec] of beforeMap) {
    if (!afterMap.has(id)) {
      removed.push(beforeRec);
    }
  }

  const summary = buildSummary(added.length, changed.length, removed.length);

  return {
    id: generateId(),
    sourceId,
    snapshotBefore: beforeSnapshotId,
    snapshotAfter: afterSnapshotId,
    added,
    changed,
    removed,
    summary,
    createdAt: nowISO(),
  };
}

function buildSummary(addedCount: number, changedCount: number, removedCount: number): string {
  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} added`);
  if (changedCount > 0) parts.push(`${changedCount} changed`);
  if (removedCount > 0) parts.push(`${removedCount} removed`);
  if (parts.length === 0) return 'No changes detected';
  return parts.join(', ');
}
