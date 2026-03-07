import { acquireLock, releaseLock } from './lock.js';
import { runExtraction } from '../extraction/pipeline.js';
import { computeDiff } from '../diffing/differ.js';
import * as sourceRepo from '../persistence/repositories/source-repo.js';
import * as configRepo from '../persistence/repositories/config-repo.js';
import * as snapshotRepo from '../persistence/repositories/snapshot-repo.js';
import * as diffRepo from '../persistence/repositories/diff-repo.js';
import * as scheduleRepo from '../persistence/repositories/schedule-repo.js';
import { nowISO } from '../shared/utils.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('runner');

export async function executeScheduledRun(sourceId: string): Promise<void> {
  if (!acquireLock(sourceId)) {
    log.warn({ sourceId }, 'Skipping scheduled run — lock held');
    return;
  }

  try {
    const source = sourceRepo.getSource(sourceId);
    if (!source || source.status !== 'active') {
      log.warn({ sourceId }, 'Source not found or not active');
      return;
    }

    const config = configRepo.getActiveConfig(sourceId);
    if (!config) {
      log.warn({ sourceId }, 'No active extraction config found');
      return;
    }

    log.info({ sourceId, sourceName: source.name }, 'Starting scheduled extraction');

    const previousSnapshot = snapshotRepo.getLatestSnapshot(sourceId);

    const { run, result } = await runExtraction(source, config, { trigger: 'scheduled' });

    // Compute diff
    if (run && result.records.length > 0) {
      const newSnapshot = snapshotRepo.getLatestSnapshot(sourceId);
      if (newSnapshot) {
        const diff = computeDiff(
          sourceId,
          previousSnapshot?.id,
          newSnapshot.id,
          previousSnapshot?.records ?? [],
          newSnapshot.records,
        );
        diffRepo.createDiff(diff);

        log.info({
          sourceId,
          added: diff.added.length,
          changed: diff.changed.length,
          removed: diff.removed.length,
        }, 'Diff computed');
      }
    }

    // Update schedule
    scheduleRepo.updateScheduleLastRun(sourceId, nowISO());

    log.info({ sourceId, records: result.records.length }, 'Scheduled extraction complete');
  } catch (error) {
    log.error({ sourceId, error: (error as Error).message }, 'Scheduled extraction failed');
  } finally {
    releaseLock(sourceId);
  }
}
