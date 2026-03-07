import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as snapshotRepo from '../../persistence/repositories/snapshot-repo.js';
import { exportJSON } from '../../export/json-exporter.js';
import { exportCSV } from '../../export/csv-exporter.js';

export function registerExportCommand(program: Command): void {
  program
    .command('export <sourceId>')
    .description('Export extracted data')
    .option('--format <format>', 'Output format (json, csv)', 'json')
    .option('--run <runId>', 'Export from a specific run')
    .option('--output <path>', 'Write to file instead of stdout')
    .action((sourceId: string, opts: { format: string; run?: string; output?: string }) => {
      const source = sourceRepo.getSource(sourceId);
      if (!source) {
        console.error(chalk.red(`Source "${sourceId}" not found`));
        process.exit(1);
      }

      let snapshot;
      if (opts.run) {
        snapshot = snapshotRepo.getSnapshotByRun(opts.run);
      } else {
        snapshot = snapshotRepo.getLatestSnapshot(sourceId);
      }

      if (!snapshot) {
        console.error(chalk.red('No data available. Run extraction first.'));
        process.exit(1);
      }

      let output: string;
      switch (opts.format) {
        case 'csv':
          output = exportCSV(snapshot.records);
          break;
        case 'json':
        default:
          output = exportJSON(snapshot.records);
          break;
      }

      if (opts.output) {
        writeFileSync(opts.output, output);
        console.error(chalk.green(`Exported ${snapshot.records.length} records to ${opts.output}`));
      } else {
        process.stdout.write(output);
      }
    });
}
