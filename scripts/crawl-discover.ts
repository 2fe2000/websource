/**
 * Non-interactive crawl discovery script.
 * Usage: npx tsx scripts/crawl-discover.ts <url> [--mode static|rendered|auto] [--max-pages N] [--rate-limit MS]
 * Output: JSON to stdout
 */
import { crawlSite } from '../src/analysis/site-crawler.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));

const modeIdx = args.indexOf('--mode');
const fetchMode = (modeIdx >= 0 ? args[modeIdx + 1] : 'auto') as 'static' | 'rendered' | 'auto';

const maxPages = parseInt(args[args.indexOf('--max-pages') + 1] ?? '20', 10) || 20;
const rateLimitMs = parseInt(args[args.indexOf('--rate-limit') + 1] ?? '800', 10) || 800;

if (!url) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'URL required' }) + '\n');
  process.exit(1);
}

try {
  const result = await crawlSite(url, { maxPages, rateLimitMs, fetchMode });

  const withStructuredData = result.pages.filter((p) => p.hasRepeatedData).length;

  const output = {
    ok: true,
    rootUrl: result.rootUrl,
    crawledAt: new Date().toISOString(),
    fetchMode,
    summary: {
      totalDiscovered: result.totalDiscovered,
      analyzed: result.pages.length,
      skipped: result.skipped,
      withStructuredData,
    },
    pages: result.pages,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
