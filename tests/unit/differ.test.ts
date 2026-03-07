import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../src/diffing/differ.js';
import type { ExtractedRecord } from '../../src/shared/types.js';

function makeRecord(id: string, title: string, price: string): ExtractedRecord {
  return {
    _id: id,
    _sourceUrl: 'https://example.com',
    _extractedAt: new Date().toISOString(),
    _confidence: 0.9,
    title,
    price,
  };
}

describe('computeDiff', () => {
  it('detects added records', () => {
    const before = [makeRecord('1', 'A', '$10')];
    const after = [makeRecord('1', 'A', '$10'), makeRecord('2', 'B', '$20')];
    const diff = computeDiff('src1', 'snap1', 'snap2', before, after);

    expect(diff.added.length).toBe(1);
    expect(diff.added[0]._id).toBe('2');
    expect(diff.changed.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });

  it('detects removed records', () => {
    const before = [makeRecord('1', 'A', '$10'), makeRecord('2', 'B', '$20')];
    const after = [makeRecord('1', 'A', '$10')];
    const diff = computeDiff('src1', 'snap1', 'snap2', before, after);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0]._id).toBe('2');
  });

  it('detects changed records', () => {
    const before = [makeRecord('1', 'A', '$10')];
    const after = [makeRecord('1', 'A', '$15')];
    const diff = computeDiff('src1', 'snap1', 'snap2', before, after);

    expect(diff.changed.length).toBe(1);
    expect(diff.changed[0].changedFields).toContain('price');
    expect(diff.changed[0].before.price).toBe('$10');
    expect(diff.changed[0].after.price).toBe('$15');
  });

  it('reports no changes when snapshots are identical', () => {
    const records = [makeRecord('1', 'A', '$10')];
    const diff = computeDiff('src1', 'snap1', 'snap2', records, records);

    expect(diff.added.length).toBe(0);
    expect(diff.changed.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.summary).toBe('No changes detected');
  });

  it('handles first run (no previous snapshot)', () => {
    const after = [makeRecord('1', 'A', '$10'), makeRecord('2', 'B', '$20')];
    const diff = computeDiff('src1', undefined, 'snap1', [], after);

    expect(diff.added.length).toBe(2);
    expect(diff.snapshotBefore).toBeUndefined();
  });
});
