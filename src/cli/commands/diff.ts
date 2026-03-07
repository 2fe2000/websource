import { Command } from 'commander';
import chalk from 'chalk';
import * as diffRepo from '../../persistence/repositories/diff-repo.js';
import * as snapshotRepo from '../../persistence/repositories/snapshot-repo.js';
import { computeDiff } from '../../diffing/differ.js';
import { formatDiffSummary } from '../formatters/diff.js';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <sourceId>')
    .description('Show changes between the last two extractions')
    .option('--run-a <id>', 'First run ID')
    .option('--run-b <id>', 'Second run ID')
    .action((sourceId: string, opts: { runA?: string; runB?: string }) => {
      if (opts.runA && opts.runB) {
        const snapA = snapshotRepo.getSnapshotByRun(opts.runA);
        const snapB = snapshotRepo.getSnapshotByRun(opts.runB);
        if (!snapA || !snapB) {
          console.error(chalk.red('Could not find snapshots for the specified runs'));
          process.exit(1);
        }
        const diff = computeDiff(sourceId, snapA.id, snapB.id, snapA.records, snapB.records);
        console.log(formatDiffSummary(diff));
        return;
      }

      const latestDiff = diffRepo.getLatestDiff(sourceId);
      if (!latestDiff) {
        console.log(chalk.dim('No diffs available. Run extraction at least twice to see changes.'));
        return;
      }

      console.log(formatDiffSummary(latestDiff));
    });
}
