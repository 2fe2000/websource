import * as cheerio from 'cheerio';
import { fetchPage } from './fetcher.js';
import { detectRepeatedBlocks, classifyPage } from './dom-analyzer.js';
import { checkRobotsTxt } from './robots.js';
import { rateLimitedWait } from '../shared/rate-limiter.js';
import { createChildLogger } from '../shared/logger.js';
import type { PageType } from '../shared/types.js';

const log = createChildLogger('site-crawler');

export interface DiscoveredPage {
  url: string;
  title: string;
  pageType: PageType;
  hasRepeatedData: boolean;
  dataItemCount: number;
  confidence: number;
  source: 'nav' | 'sitemap' | 'footer' | 'content' | 'root';
  robotsAllowed: boolean;
}

export interface SiteCrawlResult {
  rootUrl: string;
  pages: DiscoveredPage[];
  totalDiscovered: number;
  skipped: number;
}

const ASSET_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|pdf|zip|xml|json)$/i;
const IGNORE_PATHS = /\/(login|logout|signup|register|cart|checkout|account|auth|admin|api\/|wp-admin)/i;

function isSameOrigin(url: string, rootUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(rootUrl).origin;
  } catch {
    return false;
  }
}

function isUsefulUrl(url: string): boolean {
  if (ASSET_EXTENSIONS.test(url)) return false;
  if (IGNORE_PATHS.test(url)) return false;
  try {
    const u = new URL(url);
    // Skip fragment-only links
    if (!u.pathname || u.pathname === '/') return u.href.split('#')[0].endsWith('/') || u.href === u.origin + '/';
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    // Strip fragments
    resolved.hash = '';
    // Normalize index.html → root path (treat /index.html as /)
    resolved.pathname = resolved.pathname.replace(/\/index\.html?$/i, '/');
    // Strip trailing slash (except for root /)
    const href2 = resolved.href;
    return href2.endsWith('/') && resolved.pathname !== '/'
      ? href2.slice(0, -1)
      : href2;
  } catch {
    return null;
  }
}

function extractNavLinks(html: string, baseUrl: string): Array<{ url: string; source: DiscoveredPage['source'] }> {
  const $ = cheerio.load(html);
  const results: Array<{ url: string; source: DiscoveredPage['source'] }> = [];
  const seen = new Set<string>();

  const addLink = (href: string | undefined, source: DiscoveredPage['source']) => {
    if (!href) return;
    const url = normalizeUrl(href, baseUrl);
    if (!url || seen.has(url)) return;
    if (!isSameOrigin(url, baseUrl)) return;
    if (!isUsefulUrl(url)) return;
    seen.add(url);
    results.push({ url, source });
  };

  // Primary navigation (highest priority)
  $('nav a[href], header a[href], [role="navigation"] a[href]').each((_, el) => {
    addLink($(el).attr('href'), 'nav');
  });

  // Sidebar / aside navigation (category trees, directory nav)
  $('aside a[href], [class*="sidebar"] a[href], [class*="side_"] a[href], [class*="categories"] a[href], [class*="menu"] a[href]').each((_, el) => {
    addLink($(el).attr('href'), 'nav');
  });

  // Footer links (secondary)
  $('footer a[href]').each((_, el) => {
    addLink($(el).attr('href'), 'footer');
  });

  // Main content area links (e.g. category cards, directory tiles)
  $('main a[href], #content a[href], .content a[href], [class*="container"] a[href]').each((_, el) => {
    addLink($(el).attr('href'), 'content');
  });

  return results;
}

async function fetchSitemapLinks(rootUrl: string): Promise<Array<{ url: string; source: DiscoveredPage['source'] }>> {
  const origin = new URL(rootUrl).origin;
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];

  for (const sitemapUrl of candidates) {
    try {
      // Use raw fetch (no retry) — 404 is expected when sitemap doesn't exist
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'websource-crawler/0.1' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html, { xmlMode: true });
      const urls: Array<{ url: string; source: DiscoveredPage['source'] }> = [];

      $('url > loc').each((_, el) => {
        const href = $(el).text().trim();
        const normalized = normalizeUrl(href, rootUrl);
        if (normalized && isSameOrigin(normalized, rootUrl) && isUsefulUrl(normalized)) {
          urls.push({ url: normalized, source: 'sitemap' });
        }
      });

      if (urls.length > 0) {
        log.info({ count: urls.length, sitemapUrl }, 'Sitemap links discovered');
        return urls;
      }
    } catch {
      // Sitemap not found — skip silently
    }
  }

  return [];
}

async function analyzePage(url: string, fetchMode: 'static' | 'rendered' | 'auto' = 'auto'): Promise<Omit<DiscoveredPage, 'source'>> {
  const robotsAllowed = await checkRobotsTxt(url);

  if (!robotsAllowed) {
    return {
      url,
      title: url,
      pageType: 'unknown',
      hasRepeatedData: false,
      dataItemCount: 0,
      confidence: 0,
      robotsAllowed: false,
    };
  }

  const page = await fetchPage(url, { fetchMode, timeoutMs: 10000 });
  const $ = cheerio.load(page.html);
  const title = $('title').text().trim() || $('h1').first().text().trim() || url;

  const blocks = detectRepeatedBlocks(page.html);
  const classification = classifyPage(page.html, url, blocks);

  const bestBlock = blocks[0];
  const hasRepeatedData = !!bestBlock && bestBlock.confidence >= 0.3;

  return {
    url,
    title,
    pageType: classification.type,
    hasRepeatedData,
    dataItemCount: bestBlock?.count ?? 0,
    confidence: bestBlock?.confidence ?? 0,
    robotsAllowed: true,
  };
}

export async function crawlSite(
  rootUrl: string,
  options?: {
    maxPages?: number;
    rateLimitMs?: number;
    includeRootPage?: boolean;
    fetchMode?: 'static' | 'rendered' | 'auto';
  },
): Promise<SiteCrawlResult> {
  const maxPages = options?.maxPages ?? 20;
  const rateLimitMs = options?.rateLimitMs ?? 1000;
  const includeRootPage = options?.includeRootPage ?? true;
  const fetchMode = options?.fetchMode ?? 'auto';

  log.info({ rootUrl, maxPages }, 'Starting site crawl');

  // 1. Fetch root page and discover links
  const rootPage = await fetchPage(rootUrl, { fetchMode, timeoutMs: 15000 });

  // 2. Collect link candidates from nav + sitemap
  const navLinks = extractNavLinks(rootPage.html, rootUrl);
  const sitemapLinks = await fetchSitemapLinks(rootUrl);

  // Merge: sitemap preferred for completeness, nav for importance ordering
  const linkMap = new Map<string, DiscoveredPage['source']>();

  if (includeRootPage) {
    linkMap.set(normalizeUrl(rootUrl, rootUrl) ?? rootUrl, 'root');
  }

  // Nav links first (highest priority ordering)
  for (const { url, source } of navLinks) {
    if (!linkMap.has(url)) linkMap.set(url, source);
  }

  // Sitemap fills in the rest
  for (const { url, source } of sitemapLinks) {
    if (!linkMap.has(url)) linkMap.set(url, source);
  }

  const totalDiscovered = linkMap.size;
  const urlsToAnalyze = Array.from(linkMap.entries()).slice(0, maxPages);
  let skipped = Math.max(0, totalDiscovered - maxPages);

  log.info({ total: totalDiscovered, analyzing: urlsToAnalyze.length }, 'Links discovered, starting page analysis');

  // 3. Analyze each page
  const pages: DiscoveredPage[] = [];

  for (let i = 0; i < urlsToAnalyze.length; i++) {
    const [url, source] = urlsToAnalyze[i];

    if (i > 0) {
      await rateLimitedWait(url, rateLimitMs);
    }

    log.info({ url, progress: `${i + 1}/${urlsToAnalyze.length}` }, 'Analyzing page');

    try {
      const analysis = await analyzePage(url, fetchMode);
      pages.push({ ...analysis, source });
    } catch (err) {
      log.warn({ url, err }, 'Failed to analyze page, skipping');
      skipped++;
    }
  }

  // 4. Sort: pages with structured data first, then by confidence
  pages.sort((a, b) => {
    if (a.hasRepeatedData !== b.hasRepeatedData) return a.hasRepeatedData ? -1 : 1;
    if (a.source === 'root' && b.source !== 'root') return 1; // root page usually not a list
    return b.confidence - a.confidence;
  });

  log.info({ pages: pages.length, skipped }, 'Site crawl complete');

  return { rootUrl, pages, totalDiscovered, skipped };
}
