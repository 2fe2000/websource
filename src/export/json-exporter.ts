import type { ExtractedRecord } from '../shared/types.js';

export function exportJSON(records: ExtractedRecord[], pretty = true): string {
  return pretty ? JSON.stringify(records, null, 2) : JSON.stringify(records);
}
