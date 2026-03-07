import { Command } from 'commander';
import chalk from 'chalk';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import * as scheduleRepo from '../../persistence/repositories/schedule-repo.js';
import * as runRepo from '../../persistence/repositories/run-repo.js';
import { formatSourcesTable, formatRunsTable } from '../formatters/table.js';

export function registerSourcesCommand(program: Command): void {
  const sources = program
    .command('sources')
    .description('Manage data sources');

  sources
    .command('list')
    .description('List all sources')
    .option('--status <status>', 'Filter by status (active, paused, archived)')
    .action((opts: { status?: string }) => {
      const list = sourceRepo.listSources(opts.status);
      console.log(formatSourcesTable(list));
    });

  sources
    .command('show <id>')
    .description('Show details of a source')
    .action((id: string) => {
      const source = sourceRepo.getSource(id);
      if (!source) {
        console.error(chalk.red(`Source "${id}" not found`));
        process.exit(1);
      }

      const config = configRepo.getActiveConfig(id);
      const schedule = scheduleRepo.getScheduleBySource(id);
      const runs = runRepo.listRuns(id, 5);

      console.log(chalk.bold.blue('Source Details'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  ID:          ${source.id}`);
      console.log(`  Name:        ${chalk.cyan(source.name)}`);
      console.log(`  URL:         ${source.url}`);
      console.log(`  Status:      ${source.status === 'active' ? chalk.green(source.status) : chalk.dim(source.status)}`);
      console.log(`  Created:     ${source.createdAt}`);
      console.log(`  Description: ${source.description ?? chalk.dim('none')}`);
      console.log('');

      if (config) {
        console.log(chalk.bold('Extraction Config'));
        console.log(`  Fetch Mode:  ${config.fetchMode}`);
        console.log(`  Selector:    ${config.listSelector}`);
        console.log(`  Fields:      ${config.fields.map((f) => `${f.name} (${f.type})`).join(', ')}`);
        console.log(`  Pagination:  ${config.pagination ? `${config.pagination.strategy} (max ${config.pagination.maxPages} pages)` : 'none'}`);
        console.log(`  Rate Limit:  ${config.rateLimitMs}ms`);
        console.log('');
      }

      if (schedule) {
        console.log(chalk.bold('Schedule'));
        console.log(`  Cron:        ${schedule.cronExpr}`);
        console.log(`  Preset:      ${schedule.preset ?? 'custom'}`);
        console.log(`  Enabled:     ${schedule.enabled ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Last Run:    ${schedule.lastRunAt ?? chalk.dim('never')}`);
        console.log('');
      }

      if (runs.length > 0) {
        console.log(chalk.bold('Recent Runs'));
        console.log(formatRunsTable(runs));
      }
    });
}
