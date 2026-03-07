import { Command } from 'commander';
import chalk from 'chalk';
import { getDb } from '../../persistence/db.js';
import { isPlaywrightAvailable } from '../../analysis/rendered-fetcher.js';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import { getDbPath, getDataDir } from '../../config/paths.js';
import { existsSync } from 'node:fs';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run diagnostics and health checks')
    .action(async () => {
      console.log(chalk.bold.blue('websource doctor'));
      console.log('');

      const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

      // Check 1: Data directory
      const dataDir = getDataDir();
      checks.push({
        name: 'Data directory',
        ok: existsSync(dataDir),
        detail: dataDir,
      });

      // Check 2: SQLite database
      try {
        const db = getDb();
        const result = db.prepare('SELECT COUNT(*) as count FROM sources').get() as any;
        checks.push({
          name: 'SQLite database',
          ok: true,
          detail: `${getDbPath()} (${result.count} sources)`,
        });
      } catch (error) {
        checks.push({
          name: 'SQLite database',
          ok: false,
          detail: (error as Error).message,
        });
      }

      // Check 3: Playwright
      console.log(chalk.dim('Checking Playwright...'));
      const pwAvailable = await isPlaywrightAvailable();
      checks.push({
        name: 'Playwright (browser rendering)',
        ok: pwAvailable,
        detail: pwAvailable ? 'Available' : 'Not installed (run: npx playwright install chromium)',
      });

      // Check 4: Source health
      const sources = sourceRepo.listSources('active');
      for (const source of sources) {
        const config = configRepo.getActiveConfig(source.id);
        try {
          const response = await fetch(source.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10000),
          });
          checks.push({
            name: `Source: ${source.name}`,
            ok: response.ok,
            detail: `HTTP ${response.status} — ${config ? `${config.fields.length} fields configured` : 'no config'}`,
          });
        } catch (error) {
          checks.push({
            name: `Source: ${source.name}`,
            ok: false,
            detail: (error as Error).message,
          });
        }
      }

      // Print results
      console.log('');
      for (const check of checks) {
        const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${chalk.bold(check.name)}`);
        console.log(`    ${chalk.dim(check.detail)}`);
      }

      console.log('');
      const failedCount = checks.filter((c) => !c.ok).length;
      if (failedCount === 0) {
        console.log(chalk.green.bold('All checks passed!'));
      } else {
        console.log(chalk.yellow(`${failedCount} check(s) need attention.`));
      }
    });
}
