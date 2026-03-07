import { hashContent } from '../shared/utils.js';
import type { ExtractedRecord } from '../shared/types.js';

export function hashSnapshot(records: ExtractedRecord[]): string {
  const normalized = records
    .map((r) => {
      const { _extractedAt, _confidence, ...rest } = r;
      return rest;
    })
    .sort((a, b) => (a._id < b._id ? -1 : 1));

  return hashContent(JSON.stringify(normalized));
}
