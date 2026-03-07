import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { Field } from '../shared/types.js';

export interface FieldExtractionResult {
  value: string | null;
  usedSelector: string;
  usedFallback: boolean;
}

export function extractFieldValue(
  $: CheerioAPI,
  itemEl: Element,
  field: Field,
): FieldExtractionResult {
  const $item = $(itemEl);
  const selectorsToTry = [field.selector, ...(field.fallbackSelectors ?? [])];

  for (let i = 0; i < selectorsToTry.length; i++) {
    const sel = selectorsToTry[i];
    try {
      const found = $item.find(sel).first();
      if (found.length === 0) continue;

      let value: string | null = null;
      if (field.attribute) {
        value = found.attr(field.attribute) || found.attr('data-src') || null;
      } else {
        value = found.text().trim() || null;
      }

      if (value) {
        return { value, usedSelector: sel, usedFallback: i > 0 };
      }
    } catch {
      // Invalid selector, skip
      continue;
    }
  }

  return { value: null, usedSelector: field.selector, usedFallback: false };
}

export function extractAllFields(
  $: CheerioAPI,
  itemEl: Element,
  fields: Field[],
): { record: Record<string, string | null>; fallbackCount: number; missingRequired: string[] } {
  const record: Record<string, string | null> = {};
  let fallbackCount = 0;
  const missingRequired: string[] = [];

  for (const field of fields) {
    if (field.fromDetailPage) continue;

    const result = extractFieldValue($, itemEl, field);
    record[field.name] = result.value;

    if (result.usedFallback) fallbackCount++;
    if (result.value === null && field.required) {
      missingRequired.push(field.name);
    }
  }

  return { record, fallbackCount, missingRequired };
}
