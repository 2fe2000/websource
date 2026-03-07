/**
 * Dry-run extraction preview script (no data saved).
 * Usage:
 *   npx tsx scripts/preview-extraction.ts <sourceId> [--limit N]
 *   npx tsx scripts/preview-extraction.ts --config '<json>' [--limit N]
 */
import * as sourceRepo from '../src/persistence/repositories/source-repo.js';
import * as configRepo from '../src/persistence/repositories/config-repo.js';
import { runExtraction } from '../src/extraction/pipeline.js';
import { DEFAULTS } from '../src/config/defaults.js';
import { generateId, nowISO } from '../src/shared/utils.js';
import type { ExtractionConfig, Source } from '../src/shared/types.js';

const args = process.argv.slice(2);
const configIdx = args.indexOf('--config');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 5;

let source: Source;
let config: ExtractionConfig;

if (configIdx >= 0) {
  // Inline config mode
  const raw = args[configIdx + 1];
  if (!raw) {
    process.stdout.write(JSON.stringify({ ok: false, error: '--config requires a JSON argument' }) + '\n');
    process.exit(1);
  }

  let input: any;
  try { input = JSON.parse(raw); } catch {
    process.stdout.write(JSON.stringify({ ok: false, error: 'Invalid JSON for --config' }) + '\n');
    process.exit(1);
  }

  const fakeId = generateId();
  const now = nowISO();

  source = {
    id: fakeId,
    name: input.name ?? 'preview',
    url: input.url,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  config = {
    id: generateId(),
    sourceId: fakeId,
    version: 1,
    fetchMode: input.fetchMode ?? 'static',
    listSelector: input.listSelector,
    fields: input.fields ?? [],
    pagination: input.pagination,
    detailPage: input.detailPage,
    rateLimitMs: DEFAULTS.rateLimitMs,
    timeoutMs: DEFAULTS.timeoutMs,
    maxRetries: DEFAULTS.maxRetries,
    robotsPolicy: DEFAULTS.robotsPolicy,
    isActive: true,
    createdAt: now,
  };
} else {
  // Source ID mode
  const sourceId = args.find((a) => !a.startsWith('--'));
  if (!sourceId) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'sourceId or --config required' }) + '\n');
    process.exit(1);
  }

  const foundSource = sourceRepo.getSource(sourceId);
  if (!foundSource) {
    process.stdout.write(JSON.stringify({ ok: false, error: `Source not found: ${sourceId}` }) + '\n');
    process.exit(1);
  }

  const foundConfig = configRepo.getActiveConfig(sourceId);
  if (!foundConfig) {
    process.stdout.write(JSON.stringify({ ok: false, error: `No active config for source: ${sourceId}` }) + '\n');
    process.exit(1);
  }

  source = foundSource;
  config = foundConfig;
}

try {
  const { result } = await runExtraction(source, config, { dryRun: true });

  const records = result.records.slice(0, limit);

  process.stdout.write(JSON.stringify({
    ok: true,
    sourceId: source.id,
    sourceName: source.name,
    previewedAt: new Date().toISOString(),
    health: {
      status: result.health.degraded ? 'degraded' : 'healthy',
      overallConfidence: Math.round(result.health.overallConfidence * 100) / 100,
      itemCountInRange: result.health.itemCountInRange,
      degradationReasons: result.health.degradationReasons,
    },
    stats: {
      recordCount: records.length,
      totalFound: result.records.length,
      pagesFetched: result.pagesFetched,
      errorCount: result.errors.length,
    },
    records,
    errors: result.errors,
    warnings: result.health.degradationReasons.length > 0 ? result.health.degradationReasons : [],
  }, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
