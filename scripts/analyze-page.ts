/**
 * Non-interactive single page analysis script.
 * Usage: npx tsx scripts/analyze-page.ts <url> [--mode static|rendered|auto] [--wait-for <selector>] [--timeout MS]
 * Output: JSON to stdout
 */
import { analyzeSite } from '../src/analysis/index.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));

const modeIdx = args.indexOf('--mode');
const mode = (modeIdx >= 0 ? args[modeIdx + 1] : 'auto') as 'static' | 'rendered' | 'auto';

const waitForIdx = args.indexOf('--wait-for');
const waitFor = waitForIdx >= 0 ? args[waitForIdx + 1] : undefined;

const timeoutIdx = args.indexOf('--timeout');
const timeoutMs = timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1], 10) : 30000;

if (!url) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'URL required' }) + '\n');
  process.exit(1);
}

function computeFieldQuality(fields: Array<{ name: string; confidence: number }>): 'none' | 'poor' | 'weak' | 'fair' | 'good' {
  if (fields.length === 0) return 'none';
  if (fields.length === 1 && fields[0].name === 'url') return 'poor';
  if (fields.length <= 2) return 'weak';
  const avgConfidence = fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
  return avgConfidence >= 0.6 ? 'good' : 'fair';
}

try {
  const analysis = await analyzeSite(url, { fetchMode: mode, timeoutMs, waitFor });

  const fieldQuality = computeFieldQuality(analysis.suggestedFields);
  const bestBlock = analysis.repeatedBlocks[0];
  const bestPagination = analysis.paginationHints[0];
  const bestDetailLink = analysis.detailLinkHints[0];

  const warnings: string[] = [];
  if (fieldQuality === 'poor' || fieldQuality === 'none') {
    warnings.push(`Only URL/no fields detected with mode="${analysis.fetchMode}" — try --mode rendered`);
  }
  if (!analysis.robotsAllowed) {
    warnings.push('robots.txt blocks access to this URL');
  }

  const result = {
    ok: true,
    url: analysis.url,
    analyzedAt: new Date().toISOString(),
    fetchMode: analysis.fetchMode,
    fetchTimeMs: analysis.fetchTimeMs,
    renderingScore: analysis.renderingScore,
    renderingReasons: analysis.renderingReasons,
    title: analysis.title,
    pageType: analysis.pageType,
    robotsAllowed: analysis.robotsAllowed,
    fieldQuality,
    suggestedBlock: bestBlock
      ? { selector: bestBlock.selector, itemCount: bestBlock.count, confidence: bestBlock.confidence }
      : null,
    suggestedFields: analysis.suggestedFields.map((f) => ({
      name: f.name,
      selector: f.selector,
      type: f.inferredType,
      confidence: Math.round(f.confidence * 100) / 100,
      inferenceSource: f.inferenceSource,
      sampleValues: f.sampleValues,
    })),
    pagination: bestPagination
      ? { detected: true, strategy: bestPagination.strategy, selector: bestPagination.selector, confidence: bestPagination.confidence }
      : { detected: false },
    detailLinks: bestDetailLink
      ? { detected: true, selector: bestDetailLink.selector, sampleUrls: bestDetailLink.sampleUrls, confidence: bestDetailLink.confidence }
      : { detected: false },
    ogMetadata: analysis.ogMetadata,
    warnings,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
