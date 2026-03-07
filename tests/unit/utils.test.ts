import { describe, it, expect } from 'vitest';
import { generateId, hashContent, hashRecord, clamp, truncate, resolveAbsoluteUrl } from '../../src/shared/utils.js';

describe('generateId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generates 12-character IDs', () => {
    expect(generateId().length).toBe(12);
  });
});

describe('hashContent', () => {
  it('produces consistent hashes', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'));
  });
});

describe('hashRecord', () => {
  it('hashes based on key fields', () => {
    const rec = { title: 'A', price: '10', url: '/a' };
    const hash1 = hashRecord(rec, ['title', 'url']);
    const hash2 = hashRecord({ ...rec, price: '20' }, ['title', 'url']);
    expect(hash1).toBe(hash2); // price not in key fields
  });

  it('produces different hashes for different key values', () => {
    const hash1 = hashRecord({ title: 'A' }, ['title']);
    const hash2 = hashRecord({ title: 'B' }, ['title']);
    expect(hash1).not.toBe(hash2);
  });
});

describe('clamp', () => {
  it('clamps values to range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('leaves short strings alone', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
});

describe('resolveAbsoluteUrl', () => {
  it('resolves relative URLs', () => {
    expect(resolveAbsoluteUrl('/path', 'https://example.com')).toBe('https://example.com/path');
  });

  it('passes through absolute URLs', () => {
    expect(resolveAbsoluteUrl('https://other.com/path', 'https://example.com')).toBe('https://other.com/path');
  });

  it('returns null for invalid URLs', () => {
    expect(resolveAbsoluteUrl('#', 'https://example.com')).toBeNull();
    expect(resolveAbsoluteUrl('javascript:void(0)', 'https://example.com')).toBeNull();
    expect(resolveAbsoluteUrl('', 'https://example.com')).toBeNull();
  });
});
