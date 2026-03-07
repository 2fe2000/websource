/**
 * Non-interactive source creation script.
 * Usage: npx tsx scripts/create-source.ts '<json>'
 *
 * JSON shape:
 * {
 *   name: string,
 *   url: string,
 *   fetchMode: 'static' | 'rendered',
 *   listSelector: string,
 *   fields: Field[],
 *   pagination?: PaginationConfig,
 *   detailPage?: DetailPageConfig,
 *   schedule?: { cronExpr: string; preset?: string }
 * }
 */
import * as sourceRepo from '../src/persistence/repositories/source-repo.js';
import * as configRepo from '../src/persistence/repositories/config-repo.js';
import * as scheduleRepo from '../src/persistence/repositories/schedule-repo.js';
import { DEFAULTS } from '../src/config/defaults.js';

const raw = process.argv[2];

if (!raw) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'JSON config argument required' }) + '\n');
  process.exit(1);
}

let input: any;
try {
  input = JSON.parse(raw);
} catch {
  process.stdout.write(JSON.stringify({ ok: false, error: 'Invalid JSON' }) + '\n');
  process.exit(1);
}

// Validate required fields
const errors: string[] = [];
if (!input.name) errors.push('Missing required field: name');
if (!input.url) errors.push('Missing required field: url');
if (!input.listSelector) errors.push('Missing required field: listSelector');
if (!Array.isArray(input.fields)) errors.push('Missing required field: fields (must be array)');

// Validate fetchMode
const validFetchModes = ['static', 'rendered'];
if (input.fetchMode && !validFetchModes.includes(input.fetchMode)) {
  errors.push(`fetchMode must be one of: ${validFetchModes.join(', ')}`);
}

// Validate field types
const validFieldTypes = ['string', 'number', 'boolean', 'url', 'date', 'image', 'price', 'html'];
if (Array.isArray(input.fields)) {
  input.fields.forEach((f: any, i: number) => {
    if (!f.name) errors.push(`fields[${i}].name is required`);
    if (!f.selector) errors.push(`fields[${i}].selector is required`);
    if (f.type && !validFieldTypes.includes(f.type)) {
      errors.push(`fields[${i}].type must be one of: ${validFieldTypes.join(', ')}`);
    }
  });
}

if (errors.length > 0) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'Validation failed', details: errors }) + '\n');
  process.exit(1);
}

try {
  const { name, url, fetchMode, listSelector, fields, pagination, detailPage, schedule } = input;

  const source = sourceRepo.createSource({
    name,
    url,
    description: `Configured via Claude Code`,
  });

  const config = configRepo.createConfig({
    sourceId: source.id,
    version: 1,
    fetchMode: fetchMode ?? 'static',
    listSelector,
    fields,
    pagination: pagination ?? undefined,
    detailPage: detailPage ?? undefined,
    rateLimitMs: DEFAULTS.rateLimitMs,
    timeoutMs: DEFAULTS.timeoutMs,
    maxRetries: DEFAULTS.maxRetries,
    robotsPolicy: DEFAULTS.robotsPolicy,
    isActive: true,
  });

  if (schedule) {
    const cronExpr = typeof schedule === 'string' ? schedule : schedule.cronExpr;
    const preset = typeof schedule === 'string' ? undefined : schedule.preset;
    scheduleRepo.upsertSchedule({
      sourceId: source.id,
      cronExpr,
      preset,
    });
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    source,
    config: {
      id: config.id,
      sourceId: config.sourceId,
      version: config.version,
      fetchMode: config.fetchMode,
      listSelector: config.listSelector,
      fieldCount: config.fields.length,
      hasPagination: !!config.pagination,
      hasDetailPage: !!config.detailPage,
      createdAt: config.createdAt,
    },
    schedule: schedule ?? null,
    nextStep: `Run \`npx tsx scripts/preview-extraction.ts ${source.id}\` to verify extraction`,
  }, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
