import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ExtractionConfig, ExtractedRecord, ExtractionHealth, Run, Source } from '../shared/types.js';
import { fetchPage } from '../analysis/fetcher.js';
import { checkRobotsTxt } from '../analysis/robots.js';
import { extractAllFields } from './selector-engine.js';
import { normalizeRecord } from './normalizer.js';
import { computeRecordConfidence, assessExtractionHealth } from './validator.js';
import { deduplicateRecords } from './deduplicator.js';
import { resolveNextPageUrl } from './paginator.js';
import { traverseDetailPages } from './detail-traverser.js';
import { rateLimitedWait } from '../shared/rate-limiter.js';
import { hashRecord, hashContent, nowISO } from '../shared/utils.js';
import { RobotsBlockedError, WebsourceError } from '../shared/errors.js';
import { createChildLogger } from '../shared/logger.js';
import * as runRepo from '../persistence/repositories/run-repo.js';
import * as snapshotRepo from '../persistence/repositories/snapshot-repo.js';

const log = createChildLogger('pipeline');

export interface PipelineResult {
  records: ExtractedRecord[];
  health: ExtractionHealth;
  pagesFetched: number;
  errors: Array<{ phase: string; message: string }>;
}

export async function runExtraction(
  source: Source,
  config: ExtractionConfig,
  options?: { dryRun?: boolean; trigger?: Run['trigger'] },
): Promise<{ run?: Run; result: PipelineResult }> {
  const dryRun = options?.dryRun ?? false;
  const trigger = options?.trigger ?? 'manual';

  // Create run record (unless dry run)
  let run: Run | undefined;
  if (!dryRun) {
    run = runRepo.createRun({ sourceId: source.id, configId: config.id, trigger });
    runRepo.updateRunStatus(run.id, 'running', { startedAt: nowISO() });
  }

  const errors: Array<{ phase: string; message: string }> = [];
  const allRecords: ExtractedRecord[] = [];
  let pagesFetched = 0;

  try {
    // Check robots.txt
    if (config.robotsPolicy === 'respect') {
      const allowed = await checkRobotsTxt(source.url, config.userAgent);
      if (!allowed) {
        throw new RobotsBlockedError(source.url);
      }
    }

    let currentUrl: string | null = source.url;
    const maxPages = config.pagination?.maxPages ?? 1;

    while (currentUrl && pagesFetched < maxPages) {
      // Rate limit between pages
      if (pagesFetched > 0) {
        await rateLimitedWait(currentUrl, config.rateLimitMs);
      }

      log.info({ url: currentUrl, page: pagesFetched + 1 }, 'Fetching page');

      // Fetch
      let html: string;
      try {
        const page = await fetchPage(currentUrl, {
          fetchMode: config.fetchMode,
          timeoutMs: config.timeoutMs,
          userAgent: config.userAgent,
        });
        html = page.html;
      } catch (error) {
        errors.push({ phase: 'fetch', message: (error as Error).message });
        break;
      }
      pagesFetched++;

      // Parse and extract
      const $ = cheerio.load(html);
      const items = $(config.listSelector).toArray().filter((el): el is Element => el.type === 'tag');

      if (items.length === 0) {
        errors.push({ phase: 'select', message: `No items found with selector: ${config.listSelector}` });
        // Try to find next page anyway
        currentUrl = resolveNextPageUrl(html, config.pagination, currentUrl, pagesFetched);
        continue;
      }

      log.debug({ itemCount: items.length, url: currentUrl }, 'Items found on page');

      // Extract fields from each item
      for (const itemEl of items) {
        const { record: raw, fallbackCount, missingRequired } = extractAllFields($, itemEl, config.fields);

        for (const field of missingRequired) {
          errors.push({ phase: 'extract', message: `Required field "${field}" missing in an item` });
        }

        // Normalize
        const normalized = normalizeRecord(raw, config.fields, currentUrl);

        // Compute confidence
        const confidence = computeRecordConfidence(normalized, config, fallbackCount);

        // Build key fields for ID
        const keyFields = config.fields.filter((f) => f.required).map((f) => f.name);
        const recordId = hashRecord(normalized, keyFields.length > 0 ? keyFields : config.fields.map((f) => f.name));

        allRecords.push({
          _id: recordId,
          _sourceUrl: currentUrl,
          _extractedAt: nowISO(),
          _confidence: confidence,
          ...normalized,
        });
      }

      // Next page
      currentUrl = resolveNextPageUrl(html, config.pagination, currentUrl, pagesFetched);
    }

    // Detail page traversal
    let enrichedRecords = allRecords;
    if (config.detailPage && config.detailPage.fields.length > 0) {
      log.info({ recordCount: allRecords.length }, 'Starting detail page traversal');
      try {
        enrichedRecords = await traverseDetailPages(
          allRecords,
          config.detailPage,
          source.url,
        ) as ExtractedRecord[];
      } catch (error) {
        errors.push({ phase: 'detail', message: (error as Error).message });
      }
    }

    // Deduplicate
    const keyFields = config.fields.filter((f) => f.required).map((f) => f.name);
    const deduped = deduplicateRecords(enrichedRecords, keyFields.length > 0 ? keyFields : undefined);

    // Assess health
    const health = assessExtractionHealth(deduped, config, errors.length);

    const result: PipelineResult = {
      records: deduped,
      health,
      pagesFetched,
      errors,
    };

    // Persist results (unless dry run)
    if (!dryRun && run) {
      const contentHash = hashContent(JSON.stringify(deduped.map((r) => {
        const { _extractedAt, ...rest } = r;
        return rest;
      })));

      const snapshot = snapshotRepo.createSnapshot({
        runId: run.id,
        sourceId: source.id,
        records: deduped,
        contentHash,
      });

      runRepo.updateRunStatus(run.id, 'completed', {
        completedAt: nowISO(),
        recordsTotal: deduped.length,
        pagesFetched,
      });

      run = runRepo.getRun(run.id);
    }

    log.info({
      sourceId: source.id,
      records: deduped.length,
      pages: pagesFetched,
      errors: errors.length,
      health: health.degraded ? 'degraded' : 'healthy',
    }, 'Extraction complete');

    return { run, result };
  } catch (error) {
    if (run) {
      const errClass = error instanceof WebsourceError ? error.errorClass : 'unknown';
      runRepo.updateRunStatus(run.id, 'failed', {
        completedAt: nowISO(),
        errorMessage: (error as Error).message,
        errorClass: errClass,
      });
      run = runRepo.getRun(run.id);
    }

    log.error({ error, sourceId: source.id }, 'Extraction failed');

    return {
      run,
      result: {
        records: [],
        health: { overallConfidence: 0, itemCountInRange: false, requiredFieldCoverage: {}, degraded: true, degradationReasons: [(error as Error).message] },
        pagesFetched,
        errors: [...errors, { phase: 'pipeline', message: (error as Error).message }],
      },
    };
  }
}
