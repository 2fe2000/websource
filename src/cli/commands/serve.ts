import { Command } from 'commander';
import chalk from 'chalk';
import { startServer } from '../../server/index.js';
import { Scheduler } from '../../scheduling/scheduler.js';
import { DEFAULTS } from '../../config/defaults.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start local API server and scheduler')
    .option('--port <port>', 'Server port', String(DEFAULTS.serverPort))
    .option('--host <host>', 'Server host', DEFAULTS.serverHost)
    .option('--scheduler-only', 'Run only the scheduler, no HTTP server')
    .action(async (opts: { port: string; host: string; schedulerOnly?: boolean }) => {
      const scheduler = new Scheduler();
      await scheduler.start();
      console.log(chalk.green(`Scheduler started with ${scheduler.getActiveCount()} active schedule(s)`));

      if (!opts.schedulerOnly) {
        await startServer({ port: parseInt(opts.port), host: opts.host });
      } else {
        console.log(chalk.dim('Running in scheduler-only mode. Press Ctrl+C to stop.'));
      }

      // Handle graceful shutdown
      const shutdown = () => {
        console.log(chalk.dim('\nShutting down...'));
        scheduler.shutdown();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
