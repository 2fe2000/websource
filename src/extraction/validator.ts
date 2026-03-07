import type { ExtractionConfig, ExtractedRecord, ExtractionHealth } from '../shared/types.js';
import { clamp } from '../shared/utils.js';

export function computeRecordConfidence(
  record: Record<string, unknown>,
  config: ExtractionConfig,
  fallbackCount: number,
): number {
  const fields = config.fields;
  let score = 1.0;

  for (const field of fields) {
    const value = record[field.name];
    const isEmpty = value === null || value === undefined || value === '';

    if (isEmpty) {
      score -= field.required ? 0.3 : 0.05;
    }
  }

  // Penalize fallback usage
  score -= fallbackCount * 0.05;

  return clamp(score, 0, 1);
}

export function assessExtractionHealth(
  records: ExtractedRecord[],
  config: ExtractionConfig,
  errorCount: number,
): ExtractionHealth {
  const reasons: string[] = [];

  // Check item count
  const minExpected = Math.max(1, 3);
  const itemCountInRange = records.length >= minExpected;
  if (!itemCountInRange) {
    reasons.push(`Only ${records.length} items extracted, expected at least ${minExpected}`);
  }

  // Check required field coverage
  const requiredFieldCoverage: Record<string, number> = {};
  for (const field of config.fields) {
    if (!field.required) continue;
    const filled = records.filter((r) => {
      const v = r[field.name];
      return v !== null && v !== undefined && v !== '';
    }).length;
    const coverage = records.length > 0 ? filled / records.length : 0;
    requiredFieldCoverage[field.name] = coverage;
    if (coverage < 0.8) {
      reasons.push(`Required field "${field.name}" only present in ${Math.round(coverage * 100)}% of items`);
    }
  }

  // Check value uniformity (broken selector detector)
  for (const field of config.fields) {
    const values = records
      .map((r) => String(r[field.name] ?? ''))
      .filter((v) => v !== '' && v !== 'null');

    if (values.length >= 3) {
      const unique = new Set(values);
      if (unique.size === 1 && field.type !== 'boolean') {
        reasons.push(`Field "${field.name}" has identical value across all items — selector may be wrong`);
      }
    }
  }

  // Error rate
  if (errorCount > records.length * 0.3) {
    reasons.push(`High error rate: ${errorCount} errors for ${records.length} items`);
  }

  const degraded = reasons.length > 0;
  const overallConfidence = degraded
    ? clamp(records.reduce((s, r) => s + r._confidence, 0) / Math.max(records.length, 1) * 0.7, 0, 1)
    : clamp(records.reduce((s, r) => s + r._confidence, 0) / Math.max(records.length, 1), 0, 1);

  return {
    overallConfidence,
    itemCountInRange,
    requiredFieldCoverage,
    degraded,
    degradationReasons: reasons,
  };
}
