import { describe, it, expect } from 'vitest';
import { deduplicateRecords } from '../../src/extraction/deduplicator.js';
import type { ExtractedRecord } from '../../src/shared/types.js';

function makeRecord(title: string, url: string): ExtractedRecord {
  return {
    _id: `id-${title}`,
    _sourceUrl: 'https://example.com',
    _extractedAt: new Date().toISOString(),
    _confidence: 0.9,
    title,
    url,
  };
}

describe('deduplicateRecords', () => {
  it('removes duplicates by key fields', () => {
    const records = [
      makeRecord('A', '/a'),
      makeRecord('A', '/a'),
      makeRecord('B', '/b'),
    ];

    const result = deduplicateRecords(records, ['title', 'url']);
    expect(result.length).toBe(2);
  });

  it('removes duplicates by content hash when no key fields', () => {
    const records = [
      makeRecord('A', '/a'),
      makeRecord('A', '/a'),
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
  });

  it('keeps records with different values', () => {
    const records = [
      makeRecord('A', '/a'),
      makeRecord('B', '/b'),
      makeRecord('C', '/c'),
    ];

    const result = deduplicateRecords(records, ['title']);
    expect(result.length).toBe(3);
  });
});
