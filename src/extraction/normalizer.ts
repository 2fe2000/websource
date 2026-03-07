import type { TransformPipe, Field } from '../shared/types.js';
import { resolveAbsoluteUrl } from '../shared/utils.js';

// ===== Individual Normalizers =====

function trim(value: string): string {
  return value.trim();
}

function lowercase(value: string): string {
  return value.toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

function applyRegex(value: string, pattern: string, group?: number): string | null {
  const match = value.match(new RegExp(pattern));
  if (!match) return null;
  return match[group ?? 0] ?? null;
}

function applyReplace(value: string, search: string, replacement: string): string {
  return value.replace(new RegExp(search, 'g'), replacement);
}

function prefix(value: string, pre: string): string {
  return pre + value;
}

export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.,\-]/g, '');
  if (!cleaned) return null;

  // European format: 1.234,56
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  // Standard: 1,234.56 or 1234.56
  const num = parseFloat(cleaned.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

export function parsePrice(value: string): { amount: number; currency: string | null } | null {
  const currencyMatch = value.match(/^([\$€£¥₹]|USD|EUR|GBP|JPY|INR)/i);
  const currency = currencyMatch ? currencyMatch[1] : null;
  const amount = parseNumber(value);
  if (amount === null) return null;
  return { amount, currency };
}

const DATE_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => Date }> = [
  { regex: /(\d{4})-(\d{2})-(\d{2})/, parse: (m) => new Date(`${m[1]}-${m[2]}-${m[3]}`) },
  { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, parse: (m) => new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`) },
  { regex: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, parse: (m) => new Date(`${m[1]} ${m[2]}, ${m[3]}`) },
  { regex: /(\d{1,2})\s+(\w+)\s+(\d{4})/, parse: (m) => new Date(`${m[2]} ${m[1]}, ${m[3]}`) },
  {
    regex: /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i,
    parse: (m) => {
      const n = parseInt(m[1]);
      const unit = m[2].toLowerCase();
      const now = new Date();
      const ms: Record<string, number> = {
        second: 1000, minute: 60000, hour: 3600000,
        day: 86400000, week: 604800000, month: 2592000000, year: 31536000000,
      };
      return new Date(now.getTime() - n * (ms[unit] || 0));
    },
  },
];

export function parseDate(value: string): string | null {
  const cleaned = value.trim();
  for (const { regex, parse } of DATE_PATTERNS) {
    const match = cleaned.match(regex);
    if (match) {
      const date = parse(match);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }
  const fallback = Date.parse(cleaned);
  if (!isNaN(fallback)) return new Date(fallback).toISOString();
  return null;
}

export function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return ['yes', 'true', '1', 'on', 'available', 'in stock', 'active'].includes(v);
}

// ===== Transform Pipeline =====

function applyTransform(value: string, pipe: TransformPipe, baseUrl?: string): unknown {
  switch (pipe.op) {
    case 'trim': return trim(value);
    case 'lowercase': return lowercase(value);
    case 'collapseWhitespace': return collapseWhitespace(value);
    case 'stripHtml': return stripHtml(value);
    case 'regex': return applyRegex(value, pipe.pattern, pipe.group);
    case 'replace': return applyReplace(value, pipe.search, pipe.replacement);
    case 'prefix': return prefix(value, pipe.value);
    case 'parseNumber': return parseNumber(value);
    case 'parsePrice': return parsePrice(value);
    case 'parseDate': return parseDate(value);
    case 'resolveUrl': return resolveAbsoluteUrl(value, baseUrl ?? '');
    case 'parseBoolean': return parseBoolean(value);
    default: return value;
  }
}

export function normalizeRecord(
  raw: Record<string, string | null>,
  fields: Field[],
  baseUrl: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const value = raw[field.name];
    if (value === null || value === undefined) {
      result[field.name] = null;
      continue;
    }

    if (field.transform && field.transform.length > 0) {
      let current: unknown = value;
      for (const pipe of field.transform) {
        if (typeof current !== 'string') break;
        current = applyTransform(current, pipe, baseUrl);
      }
      result[field.name] = current;
    } else {
      // Auto-normalize based on type
      switch (field.type) {
        case 'url':
        case 'image':
          result[field.name] = resolveAbsoluteUrl(value, baseUrl);
          break;
        case 'number':
          result[field.name] = parseNumber(value);
          break;
        case 'price':
          result[field.name] = parsePrice(value);
          break;
        case 'date':
          result[field.name] = parseDate(value);
          break;
        case 'boolean':
          result[field.name] = parseBoolean(value);
          break;
        default:
          result[field.name] = collapseWhitespace(value);
      }
    }
  }

  return result;
}
