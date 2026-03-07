import * as cheerio from 'cheerio';
import type { DetailPageConfig, Field } from '../shared/types.js';
import { fetchPage } from '../analysis/fetcher.js';
import { extractFieldValue } from './selector-engine.js';
import { normalizeRecord } from './normalizer.js';
import { rateLimitedWait } from '../shared/rate-limiter.js';
import { resolveAbsoluteUrl, sleep } from '../shared/utils.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('detail-traverser');

export async function extractDetailFields(
  detailUrl: string,
  detailConfig: DetailPageConfig,
  baseUrl: string,
): Promise<Record<string, unknown>> {
  const rateLimitMs = detailConfig.rateLimitMs ?? 1000;
  await rateLimitedWait(detailUrl, rateLimitMs);

  const page = await fetchPage(detailUrl, {
    fetchMode: detailConfig.fetchMode ?? 'static',
  });

  const $ = cheerio.load(page.html);
  const root = $('body').get(0)!;
  const raw: Record<string, string | null> = {};

  for (const field of detailConfig.fields) {
    const result = extractFieldValue($, root, field);
    raw[field.name] = result.value;
  }

  return normalizeRecord(raw, detailConfig.fields, detailUrl);
}

export async function traverseDetailPages(
  records: Array<Record<string, unknown>>,
  detailConfig: DetailPageConfig,
  baseUrl: string,
): Promise<Array<Record<string, unknown>>> {
  const linkAttr = detailConfig.linkAttribute ?? 'href';
  const enrichedRecords: Array<Record<string, unknown>> = [];

  for (const record of records) {
    const detailUrl = record.url as string | undefined;
    if (!detailUrl) {
      enrichedRecords.push(record);
      continue;
    }

    const absoluteUrl = resolveAbsoluteUrl(String(detailUrl), baseUrl);
    if (!absoluteUrl) {
      enrichedRecords.push(record);
      continue;
    }

    try {
      log.debug({ url: absoluteUrl }, 'Fetching detail page');
      const detailFields = await extractDetailFields(absoluteUrl, detailConfig, baseUrl);
      enrichedRecords.push({ ...record, ...detailFields });
    } catch (error) {
      log.warn({ url: absoluteUrl, error: (error as Error).message }, 'Failed to fetch detail page');
      enrichedRecords.push(record);
    }
  }

  return enrichedRecords;
}
