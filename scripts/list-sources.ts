/**
 * List all saved sources with stats.
 * Usage: npx tsx scripts/list-sources.ts [--status active|paused|archived]
 * Output: JSON to stdout
 */
import * as sourceRepo from '../src/persistence/repositories/source-repo.js';
import * as runRepo from '../src/persistence/repositories/run-repo.js';
import * as scheduleRepo from '../src/persistence/repositories/schedule-repo.js';
import * as snapshotRepo from '../src/persistence/repositories/snapshot-repo.js';

const args = process.argv.slice(2);
const statusIdx = args.indexOf('--status');
const statusFilter = statusIdx >= 0 ? args[statusIdx + 1] : undefined;

try {
  const sources = sourceRepo.listSources(statusFilter);

  const result = await Promise.all(sources.map(async (source) => {
    const latestRun = runRepo.getLatestRun(source.id);
    const schedule = scheduleRepo.getScheduleBySource(source.id);
    const latestSnapshot = snapshotRepo.getLatestSnapshot(source.id);

    return {
      id: source.id,
      name: source.name,
      url: source.url,
      status: source.status,
      createdAt: source.createdAt,
      recordCount: latestSnapshot?.recordCount ?? 0,
      lastRun: latestRun
        ? {
            runAt: latestRun.completedAt ?? latestRun.startedAt,
            status: latestRun.status,
            recordsTotal: latestRun.recordsTotal,
            recordsNew: latestRun.recordsNew,
            recordsChanged: latestRun.recordsChanged,
            recordsRemoved: latestRun.recordsRemoved,
          }
        : null,
      hasSchedule: !!schedule?.enabled,
      schedule: schedule
        ? { cronExpr: schedule.cronExpr, preset: schedule.preset, nextRunAt: schedule.nextRunAt }
        : null,
    };
  }));

  process.stdout.write(JSON.stringify({ ok: true, count: result.length, sources: result }, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
