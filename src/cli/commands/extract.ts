import { Command } from 'commander';
import chalk from 'chalk';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import * as snapshotRepo from '../../persistence/repositories/snapshot-repo.js';
import * as diffRepo from '../../persistence/repositories/diff-repo.js';
import { runExtraction } from '../../extraction/pipeline.js';
import { computeDiff } from '../../diffing/differ.js';
import { formatDiffSummary } from '../formatters/diff.js';

export function registerExtractCommand(program: Command): void {
  program
    .command('extract <sourceId>')
    .description('Run extraction and save results')
    .action(async (sourceId: string) => {
      const source = sourceRepo.getSource(sourceId);
      if (!source) {
        console.error(chalk.red(`Source "${sourceId}" not found`));
        process.exit(1);
      }

      const config = configRepo.getActiveConfig(sourceId);
      if (!config) {
        console.error(chalk.red('No active extraction config found'));
        process.exit(1);
      }

      const previousSnapshot = snapshotRepo.getLatestSnapshot(sourceId);

      console.log(chalk.bold.blue('Extracting: ') + chalk.cyan(source.name));
      console.log(chalk.dim(source.url));
      console.log('');

      const { run, result } = await runExtraction(source, config, { trigger: 'manual' });

      if (result.records.length === 0) {
        console.log(chalk.yellow('No records extracted.'));
        if (result.errors.length > 0) {
          for (const err of result.errors) {
            console.log(chalk.red(`  [${err.phase}] ${err.message}`));
          }
        }
        return;
      }

      console.log(chalk.green(`${result.records.length} records extracted from ${result.pagesFetched} page(s)`));

      if (run) {
        console.log(chalk.dim(`Run ID: ${run.id}`));
      }

      // Compute and show diff
      const newSnapshot = snapshotRepo.getLatestSnapshot(sourceId);
      if (newSnapshot && (previousSnapshot || !previousSnapshot)) {
        const diff = computeDiff(
          sourceId,
          previousSnapshot?.id,
          newSnapshot.id,
          previousSnapshot?.records ?? [],
          newSnapshot.records,
        );
        diffRepo.createDiff(diff);

        console.log('');
        console.log(formatDiffSummary(diff));
      }

      if (result.health.degraded) {
        console.log('');
        console.log(chalk.yellow('Health warnings:'));
        for (const reason of result.health.degradationReasons) {
          console.log(chalk.yellow(`  - ${reason}`));
        }
      }
    });
}
