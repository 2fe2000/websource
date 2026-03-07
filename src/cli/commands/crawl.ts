import { Command } from 'commander';
import { checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { crawlSite, type DiscoveredPage } from '../../analysis/site-crawler.js';
import { runConversation } from '../prompts/conversation.js';

function pageTypeLabel(type: string): string {
  switch (type) {
    case 'list': return chalk.green('list');
    case 'detail': return chalk.blue('detail');
    case 'article': return chalk.cyan('article');
    case 'directory': return chalk.magenta('directory');
    default: return chalk.dim(type);
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'nav': return chalk.bold('nav');
    case 'sitemap': return chalk.dim('sitemap');
    case 'footer': return chalk.dim('footer');
    case 'content': return chalk.dim('content');
    case 'root': return chalk.yellow('root');
    default: return source;
  }
}

function formatPageRow(page: DiscoveredPage, index: number): string {
  const num = chalk.dim(`${String(index + 1).padStart(2)}.`);
  const data = page.hasRepeatedData
    ? chalk.green(`✓ ${page.dataItemCount} items`)
    : chalk.dim('  no data  ');
  const type = pageTypeLabel(page.pageType).padEnd(10);
  const src = sourceLabel(page.source).padEnd(8);
  const robots = page.robotsAllowed ? '' : chalk.red(' [robots blocked]');
  const title = page.title.slice(0, 50);
  const url = chalk.dim(page.url.slice(0, 60));
  return `${num} ${data}  ${type} ${src}  ${title}\n       ${url}${robots}`;
}

export function registerCrawlCommand(program: Command): void {
  program
    .command('crawl <url>')
    .description('Discover all important pages on a site and set up sources for selected ones')
    .option('--max-pages <n>', 'Maximum pages to analyze', '20')
    .option('--rate-limit <ms>', 'Milliseconds between requests', '1000')
    .action(async (url: string, opts) => {
      const maxPages = parseInt(opts.maxPages, 10);
      const rateLimitMs = parseInt(opts.rateLimit, 10);

      // Validate URL
      try {
        new URL(url);
      } catch {
        console.error(chalk.red('Invalid URL. Provide a full URL e.g. https://example.com'));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.bold.blue('websource crawl') + ' — discovering pages on ' + chalk.underline(url));
      console.log(chalk.dim(`Analyzing up to ${maxPages} pages with ${rateLimitMs}ms rate limit...`));
      console.log('');

      // Crawl
      let result;
      try {
        result = await crawlSite(url, { maxPages, rateLimitMs });
      } catch (err) {
        console.error(chalk.red('Failed to crawl site:'), (err as Error).message);
        process.exit(1);
      }

      const { pages, totalDiscovered, skipped } = result;

      if (pages.length === 0) {
        console.log(chalk.yellow('No pages discovered. Check that the URL is accessible.'));
        return;
      }

      // Show results table
      console.log(chalk.bold(`Discovered ${totalDiscovered} pages, analyzed ${pages.length}:`));
      if (skipped > 0) {
        console.log(chalk.dim(`  (${skipped} skipped due to limit or errors)`));
      }
      console.log('');

      pages.forEach((page, i) => {
        console.log(formatPageRow(page, i));
      });
      console.log('');

      // Filter to only pages with structured data for the checkbox prompt
      const dataPages = pages.filter((p) => p.hasRepeatedData && p.robotsAllowed);
      const otherPages = pages.filter((p) => !p.hasRepeatedData && p.robotsAllowed);

      if (dataPages.length === 0) {
        console.log(chalk.yellow('No pages with repeated structured data were found.'));
        console.log(chalk.dim('Try running `websource scan <url>` on specific pages to investigate further.'));
        return;
      }

      // Let user pick pages to set up as sources
      console.log(chalk.bold('Which pages do you want to set up as data sources?'));
      console.log(chalk.dim('(Only pages with detected structured data are shown)'));
      console.log('');

      const choices = [
        ...dataPages.map((p) => ({
          name: `[${p.dataItemCount} items] ${p.title.slice(0, 50)}\n  ${chalk.dim(p.url)}`,
          value: p.url,
          checked: true, // default: select all data pages
        })),
        ...otherPages.map((p) => ({
          name: `[no data]  ${p.title.slice(0, 50)}\n  ${chalk.dim(p.url)}`,
          value: p.url,
          checked: false,
        })),
      ];

      let selectedUrls: string[];
      try {
        selectedUrls = await checkbox({
          message: 'Select pages to configure (space to toggle, enter to confirm):',
          choices,
        });
      } catch {
        console.log(chalk.dim('\nCancelled.'));
        return;
      }

      if (selectedUrls.length === 0) {
        console.log(chalk.yellow('No pages selected. Exiting.'));
        return;
      }

      console.log('');
      console.log(chalk.bold(`Setting up ${selectedUrls.length} source(s)...`));

      // Run init conversation for each selected page
      for (let i = 0; i < selectedUrls.length; i++) {
        const pageUrl = selectedUrls[i];
        console.log('');
        console.log(chalk.bold.blue(`─── Source ${i + 1} of ${selectedUrls.length} ───`));
        console.log(chalk.dim(pageUrl));
        console.log('');

        try {
          await runConversation(pageUrl);
        } catch (err) {
          console.error(chalk.red(`Failed to set up source for ${pageUrl}:`), (err as Error).message);

          if (i < selectedUrls.length - 1) {
            let skip = false;
            try {
              skip = !(await confirm({ message: 'Continue with next page?' }));
            } catch {
              skip = true;
            }
            if (skip) break;
          }
        }
      }

      console.log('');
      console.log(chalk.green.bold('Done!'));
      console.log(chalk.dim('Run `websource sources list` to see all configured sources.'));
    });
}
