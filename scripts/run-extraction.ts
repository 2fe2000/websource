/**
 * Run extraction for a saved source and return stats.
 * Usage: npx tsx scripts/run-extraction.ts <sourceId> [--trigger manual|scheduled|api]
 * Output: JSON to stdout
 */
import * as sourceRepo from '../src/persistence/repositories/source-repo.js';
import * as configRepo from '../src/persistence/repositories/config-repo.js';
import { runExtraction } from '../src/extraction/pipeline.js';
import type { Run } from '../src/shared/types.js';

const args = process.argv.slice(2);
const sourceId = args.find((a) => !a.startsWith('--'));
const triggerIdx = args.indexOf('--trigger');
const trigger = (triggerIdx >= 0 ? args[triggerIdx + 1] : 'manual') as Run['trigger'];

if (!sourceId) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'sourceId required' }) + '\n');
  process.exit(1);
}

const source = sourceRepo.getSource(sourceId);
if (!source) {
  process.stdout.write(JSON.stringify({ ok: false, error: `Source not found: ${sourceId}` }) + '\n');
  process.exit(1);
}

const config = configRepo.getActiveConfig(sourceId);
if (!config) {
  process.stdout.write(JSON.stringify({ ok: false, error: `No active config for source: ${sourceId}` }) + '\n');
  process.exit(1);
}

try {
  const startedAt = Date.now();
  const { run, result } = await runExtraction(source, config, { dryRun: false, trigger });
  const durationMs = Date.now() - startedAt;

  const unchanged =
    (run?.recordsNew ?? 0) === 0 &&
    (run?.recordsChanged ?? 0) === 0 &&
    (run?.recordsRemoved ?? 0) === 0;

  process.stdout.write(JSON.stringify({
    ok: result.errors.length === 0 || result.records.length > 0,
    runId: run?.id,
    sourceId: source.id,
    sourceName: source.name,
    completedAt: new Date().toISOString(),
    stats: {
      recordsTotal: run?.recordsTotal ?? result.records.length,
      recordsNew: run?.recordsNew ?? 0,
      recordsChanged: run?.recordsChanged ?? 0,
      recordsRemoved: run?.recordsRemoved ?? 0,
      pagesFetched: result.pagesFetched,
      durationMs,
    },
    health: {
      status: result.health.degraded ? 'degraded' : 'healthy',
      overallConfidence: Math.round(result.health.overallConfidence * 100) / 100,
      degradationReasons: result.health.degradationReasons,
    },
    unchanged,
    errors: result.errors,
  }, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
