import { fetchPage } from './fetcher.js';
import { detectRepeatedBlocks, classifyPage } from './dom-analyzer.js';
import { inferFields, extractPageOpenGraph } from './field-inferrer.js';
import { detectPagination } from './pagination-detector.js';
import { detectDetailLinks } from './detail-link-detector.js';
import { checkRobotsTxt } from './robots.js';
import { createChildLogger } from '../shared/logger.js';
import * as cheerio from 'cheerio';
import type { SiteAnalysis } from '../shared/types.js';

const log = createChildLogger('analysis');

// Returns true if the static HTML has meaningful field-detectable content.
// Used as the onStaticResult hook to trigger rendered retry.
function staticHasUsableFields(html: string): boolean {
  const blocks = detectRepeatedBlocks(html);
  if (blocks.length === 0) return false;
  const fields = inferFields(html, blocks[0], { fullHtml: html });
  // Empty or url-only = not usable
  if (fields.length === 0) return false;
  if (fields.length === 1 && fields[0].name === 'url') return false;
  // Fewer than 3 fields = likely navigation/category links, not real content
  if (fields.length < 3) return false;
  // All fields are only title/url = navigation, not content
  if (fields.every((f) => f.name === 'url' || f.name === 'title')) return false;
  return true;
}

export async function analyzeSite(
  url: string,
  options?: { fetchMode?: 'static' | 'rendered' | 'auto'; timeoutMs?: number; userAgent?: string; waitFor?: string },
): Promise<SiteAnalysis> {
  log.info({ url }, 'Starting site analysis');

  // Check robots.txt
  const robotsAllowed = await checkRobotsTxt(url, options?.userAgent);

  // Fetch the page — auto mode uses quality-check hook to trigger rendered retry
  const page = await fetchPage(url, {
    fetchMode: options?.fetchMode ?? 'auto',
    timeoutMs: options?.timeoutMs,
    userAgent: options?.userAgent,
    waitFor: options?.waitFor,
    onStaticResult: options?.fetchMode === 'auto' || !options?.fetchMode
      ? staticHasUsableFields
      : undefined,
  });

  const $ = cheerio.load(page.html);
  const title = $('title').text().trim() || $('h1').first().text().trim() || url;

  // Detect repeated blocks first (used by classifyPage too)
  const repeatedBlocks = detectRepeatedBlocks(page.html);

  // Classify page type (pass blocks to avoid re-detection)
  const classification = classifyPage(page.html, url, repeatedBlocks);

  // Infer fields from the best block — pass full HTML for JSON-LD/OG extraction
  const bestBlock = repeatedBlocks[0];
  const suggestedFields = bestBlock
    ? inferFields(page.html, bestBlock, { fullHtml: page.html })
    : [];

  // Extract Open Graph metadata for the page
  const ogMetadata = extractPageOpenGraph(page.html);

  // Detect pagination
  const paginationHints = detectPagination(page.html, url);

  // Detect detail links
  const detailLinkHints = bestBlock ? detectDetailLinks(page.html, bestBlock, url) : [];

  const analysis: SiteAnalysis = {
    url,
    title,
    fetchMode: page.fetchMode,
    pageType: classification.type,
    repeatedBlocks,
    suggestedFields,
    paginationHints,
    detailLinkHints,
    robotsAllowed,
    fetchTimeMs: page.fetchTimeMs,
    renderingScore: page.renderingScore,
    renderingReasons: page.renderingReasons,
    ogMetadata: Object.keys(ogMetadata).length > 0 ? ogMetadata : undefined,
  };

  log.info({
    url,
    pageType: classification.type,
    blocks: repeatedBlocks.length,
    fields: suggestedFields.length,
    fetchMode: page.fetchMode,
    renderingScore: page.renderingScore,
    pagination: paginationHints.length > 0,
    detailLinks: detailLinkHints.length > 0,
  }, 'Site analysis complete');

  return analysis;
}
