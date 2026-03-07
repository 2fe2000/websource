import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerCrawlCommand } from './commands/crawl.js';
import { registerScanCommand } from './commands/scan.js';
import { registerSourcesCommand } from './commands/sources.js';
import { registerPreviewCommand } from './commands/preview.js';
import { registerExtractCommand } from './commands/extract.js';
import { registerDiffCommand } from './commands/diff.js';
import { registerScheduleCommand } from './commands/schedule.js';
import { registerServeCommand } from './commands/serve.js';
import { registerExportCommand } from './commands/export.js';
import { registerDoctorCommand } from './commands/doctor.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('websource')
    .description('Turn websites into reusable structured data sources')
    .version('0.1.0');

  registerInitCommand(program);
  registerCrawlCommand(program);
  registerScanCommand(program);
  registerSourcesCommand(program);
  registerPreviewCommand(program);
  registerExtractCommand(program);
  registerDiffCommand(program);
  registerScheduleCommand(program);
  registerServeCommand(program);
  registerExportCommand(program);
  registerDoctorCommand(program);

  return program;
}
