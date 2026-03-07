import { Command } from 'commander';
import chalk from 'chalk';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import { runExtraction } from '../../extraction/pipeline.js';
import { formatRecordsTable } from '../formatters/table.js';

export function registerPreviewCommand(program: Command): void {
  program
    .command('preview <sourceId>')
    .description('Preview extraction without saving results')
    .option('--limit <n>', 'Number of records to show', '10')
    .action(async (sourceId: string, opts: { limit: string }) => {
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

      console.log(chalk.bold.blue('Preview: ') + chalk.cyan(source.name));
      console.log(chalk.dim('Dry run — results will not be saved'));
      console.log('');

      const { result } = await runExtraction(source, config, { dryRun: true });
      const limit = parseInt(opts.limit);

      if (result.records.length === 0) {
        console.log(chalk.yellow('No records extracted.'));
        if (result.errors.length > 0) {
          console.log(chalk.red('Errors:'));
          for (const err of result.errors) {
            console.log(chalk.red(`  [${err.phase}] ${err.message}`));
          }
        }
        return;
      }

      const fieldNames = config.fields.map((f) => f.name);
      console.log(formatRecordsTable(result.records.slice(0, limit), fieldNames));
      console.log('');
      console.log(`${chalk.bold(result.records.length)} records extracted from ${result.pagesFetched} page(s)`);

      if (result.health.degraded) {
        console.log(chalk.yellow('\nHealth warnings:'));
        for (const reason of result.health.degradationReasons) {
          console.log(chalk.yellow(`  - ${reason}`));
        }
      }

      console.log('');
      console.log(chalk.dim(`To save results, run: websource extract ${sourceId}`));
    });
}
