import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid(12);
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function hashRecord(record: Record<string, unknown>, keyFields: string[]): string {
  const values = keyFields.map((f) => String(record[f] ?? ''));
  return createHash('sha256').update(values.join('|')).digest('hex').slice(0, 16);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    const trimmed = href.trim();
    if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:')) return null;
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowISO(): string {
  return new Date().toISOString();
}
