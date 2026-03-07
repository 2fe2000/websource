import { stringify } from 'csv-stringify/sync';
import type { ExtractedRecord } from '../shared/types.js';

export function exportCSV(records: ExtractedRecord[], includeMetaFields = false): string {
  if (records.length === 0) return '';

  // Determine columns
  const allKeys = new Set<string>();
  for (const rec of records) {
    for (const key of Object.keys(rec)) {
      if (!includeMetaFields && key.startsWith('_')) continue;
      allKeys.add(key);
    }
  }

  const columns = [...allKeys];

  const rows = records.map((rec) =>
    columns.map((col) => {
      const val = rec[col];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }),
  );

  return stringify([columns, ...rows]);
}
