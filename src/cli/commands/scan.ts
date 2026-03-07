import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeSite } from '../../analysis/index.js';
import { formatBlocksTable, formatFieldsTable } from '../formatters/table.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan <url>')
    .description('Analyze a website and show extractable data structure')
    .option('--rendered', 'Force browser rendering')
    .option('--timeout <ms>', 'Fetch timeout in ms', '30000')
    .action(async (url: string, opts: { rendered?: boolean; timeout: string }) => {
      try {
        new URL(url);
      } catch {
        console.error(chalk.red('Invalid URL'));
        process.exit(1);
      }

      console.log(chalk.bold.blue('Scanning ') + chalk.underline(url) + ' ...');
      console.log('');

      const analysis = await analyzeSite(url, {
        fetchMode: opts.rendered ? 'rendered' : 'auto',
        timeoutMs: parseInt(opts.timeout),
      });

      console.log(chalk.bold('Results'));
      console.log(`  Title:      ${chalk.cyan(analysis.title)}`);
      console.log(`  Page Type:  ${chalk.cyan(analysis.pageType)}`);
      console.log(`  Fetch Mode: ${analysis.fetchMode === 'rendered' ? chalk.yellow('Rendered') : chalk.green('Static')}`);
      console.log(`  Robots:     ${analysis.robotsAllowed ? chalk.green('Allowed') : chalk.red('Blocked')}`);
      console.log(`  Fetch Time: ${analysis.fetchTimeMs}ms`);
      console.log('');

      if (analysis.repeatedBlocks.length > 0) {
        console.log(chalk.bold(`Repeated Blocks (${analysis.repeatedBlocks.length}):`));
        console.log(formatBlocksTable(analysis.repeatedBlocks));
        console.log('');
      } else {
        console.log(chalk.yellow('No repeated data blocks found.'));
        console.log('');
      }

      if (analysis.suggestedFields.length > 0) {
        console.log(chalk.bold(`Suggested Fields (${analysis.suggestedFields.length}):`));
        console.log(formatFieldsTable(analysis.suggestedFields));
        console.log('');
      }

      if (analysis.paginationHints.length > 0) {
        const hint = analysis.paginationHints[0];
        console.log(chalk.bold('Pagination:') + ` ${hint.strategy} (${Math.round(hint.confidence * 100)}% confidence)`);
        console.log('');
      }

      if (analysis.detailLinkHints.length > 0) {
        const hint = analysis.detailLinkHints[0];
        console.log(chalk.bold('Detail Links:') + ` ${hint.selector} (${Math.round(hint.confidence * 100)}% confidence)`);
        for (const u of hint.sampleUrls.slice(0, 3)) {
          console.log(chalk.dim(`  ${u}`));
        }
        console.log('');
      }

      console.log(chalk.dim('To create a source from this analysis, run:'));
      console.log(chalk.dim(`  websource init ${url}`));
    });
}
