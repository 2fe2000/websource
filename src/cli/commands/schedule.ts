import { Command } from 'commander';
import chalk from 'chalk';
import cron from 'node-cron';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as scheduleRepo from '../../persistence/repositories/schedule-repo.js';

const PRESETS: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '0 0 * * *',
  weekly: '0 0 * * 0',
};

export function registerScheduleCommand(program: Command): void {
  program
    .command('schedule <sourceId> <expression>')
    .description('Set extraction schedule (hourly, daily, weekly, or cron expression)')
    .action((sourceId: string, expression: string) => {
      const source = sourceRepo.getSource(sourceId);
      if (!source) {
        console.error(chalk.red(`Source "${sourceId}" not found`));
        process.exit(1);
      }

      let cronExpr: string;
      let preset: string | undefined;

      if (PRESETS[expression]) {
        cronExpr = PRESETS[expression];
        preset = expression;
      } else if (cron.validate(expression)) {
        cronExpr = expression;
        preset = 'custom';
      } else {
        console.error(chalk.red(`Invalid schedule: "${expression}"`));
        console.error(chalk.dim('Use: hourly, daily, weekly, or a cron expression'));
        process.exit(1);
      }

      scheduleRepo.upsertSchedule({ sourceId, cronExpr, preset });

      console.log(chalk.green(`Schedule set for "${source.name}": ${preset ?? 'custom'} (${cronExpr})`));
      console.log(chalk.dim('Start the scheduler with: websource serve'));
    });
}
