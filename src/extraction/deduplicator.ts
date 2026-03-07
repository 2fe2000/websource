import { hashContent } from '../shared/utils.js';
import type { ExtractedRecord } from '../shared/types.js';

export function deduplicateRecords(
  records: ExtractedRecord[],
  keyFields?: string[],
): ExtractedRecord[] {
  const seen = new Set<string>();
  const result: ExtractedRecord[] = [];

  for (const record of records) {
    let key: string;

    if (keyFields && keyFields.length > 0) {
      key = keyFields.map((f) => String(record[f] ?? '')).join('|');
    } else {
      // Hash all non-meta fields
      const data = Object.fromEntries(
        Object.entries(record).filter(([k]) => !k.startsWith('_')),
      );
      key = hashContent(JSON.stringify(data));
    }

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }

  return result;
}
