import { describe, it, expect } from 'vitest';
import { parseNumber, parsePrice, parseDate, parseBoolean } from '../../src/extraction/normalizer.js';

describe('parseNumber', () => {
  it('parses simple integers', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('0')).toBe(0);
  });

  it('parses decimals', () => {
    expect(parseNumber('19.99')).toBe(19.99);
    expect(parseNumber('3.14')).toBeCloseTo(3.14);
  });

  it('handles US format with commas', () => {
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('1,234,567.89')).toBe(1234567.89);
  });

  it('handles European format', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1.234.567,89')).toBe(1234567.89);
  });

  it('strips currency symbols', () => {
    expect(parseNumber('$19.99')).toBe(19.99);
    expect(parseNumber('€1.234,56')).toBe(1234.56);
  });

  it('returns null for non-numeric', () => {
    expect(parseNumber('hello')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
});

describe('parsePrice', () => {
  it('parses USD prices', () => {
    const result = parsePrice('$29.99');
    expect(result).toEqual({ amount: 29.99, currency: '$' });
  });

  it('parses EUR prices', () => {
    const result = parsePrice('€49.00');
    expect(result).toEqual({ amount: 49, currency: '€' });
  });

  it('parses GBP prices', () => {
    const result = parsePrice('£100');
    expect(result).toEqual({ amount: 100, currency: '£' });
  });

  it('parses prices without currency', () => {
    const result = parsePrice('29.99');
    expect(result).toEqual({ amount: 29.99, currency: null });
  });

  it('returns null for non-price text', () => {
    expect(parsePrice('free')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parses ISO dates', () => {
    const result = parseDate('2024-03-15');
    expect(result).toContain('2024-03-15');
  });

  it('parses US dates', () => {
    const result = parseDate('03/15/2024');
    expect(result).toContain('2024-03-15');
  });

  it('parses month name dates', () => {
    const result = parseDate('March 15, 2024');
    expect(result).toBeTruthy();
    const d = new Date(result!);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2); // March = 2
  });

  it('parses day-first dates', () => {
    const result = parseDate('15 March 2024');
    expect(result).toBeTruthy();
    const d = new Date(result!);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
  });

  it('parses relative dates', () => {
    const result = parseDate('2 days ago');
    expect(result).toBeTruthy();
    const parsed = new Date(result!);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    expect(Math.abs(parsed.getTime() - twoDaysAgo.getTime())).toBeLessThan(60000);
  });

  it('returns null for non-date text', () => {
    expect(parseDate('hello world')).toBeNull();
  });
});

describe('parseBoolean', () => {
  it('recognizes true values', () => {
    expect(parseBoolean('yes')).toBe(true);
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('In Stock')).toBe(true);
    expect(parseBoolean('available')).toBe(true);
  });

  it('recognizes false values', () => {
    expect(parseBoolean('no')).toBe(false);
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean('out of stock')).toBe(false);
  });
});
