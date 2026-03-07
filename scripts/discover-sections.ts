/**
 * Discover sub-sections / category tabs on a page (generic, site-agnostic).
 * Usage: npx tsx scripts/discover-sections.ts <url> [--mode static|rendered|auto]
 * Output: JSON to stdout
 *
 * Detection strategies (applied in order, best group wins):
 *  1. Child-path tabs  — /leaderboard/webapps, /leaderboard/mobile, …
 *  2. Nav/tab context  — <a> groups inside nav, [role="tablist"], [class*="categ"] etc.
 *  3. Query-param cats — ?category=electronics, ?type=shirts, …
 *  4. Top-level nav    — depth-1 links when starting from the homepage
 */
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { fetchPage } from '../src/analysis/fetcher.js';

const args = process.argv.slice(2);
const inputUrl = args.find((a) => !a.startsWith('--'));
const modeIdx = args.indexOf('--mode');
const mode = (modeIdx >= 0 ? args[modeIdx + 1] : 'auto') as 'static' | 'rendered' | 'auto';

if (!inputUrl) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'URL required' }) + '\n');
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionLink { label: string; url: string; }
interface LinkInfo {
  label: string;
  url: string;
  path: string;
  search: string;
  depth: number;
  inNavContext: boolean;
}
interface SectionGroup {
  links: SectionLink[];
  score: number;
  strategy: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveUrl(href: string, base: string): URL | null {
  try { return new URL(href, base); } catch { return null; }
}

function cleanLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Returns true if element is inside a nav/tab/category/sidebar context
function isNavContext($: CheerioAPI, el: Element): boolean {
  const navSelectors = [
    'nav', '[role="navigation"]', '[role="tablist"]', '[role="menubar"]',
    '[aria-label*="categor" i]', '[aria-label*="filter" i]', '[aria-label*="tab" i]',
    '[class*="categor"]', '[class*="filter"]', '[class*="sidebar"]',
    '[class*="tabs"]', '[class*="nav-"]', '[class*="-nav"]',
    'aside', '[class*="menu"]',
  ];
  return navSelectors.some((sel) => $(el).closest(sel).length > 0);
}

// ─── Link collection ──────────────────────────────────────────────────────────

function collectLinks($: CheerioAPI, pageUrl: string, origin: string): LinkInfo[] {
  const seen = new Set<string>();
  const links: LinkInfo[] = [];

  $('a[href]').each((_, el) => {
    const elEl = el as Element;
    const href = $(elEl).attr('href') || '';
    const parsed = resolveUrl(href, pageUrl);
    if (!parsed || parsed.origin !== origin) return;

    // Normalise: strip fragment, trailing slash, and common index filenames
    let path = parsed.pathname
      .replace(/\/index\.(html?|php|asp)$/i, '') // /category/foo/index.html → /category/foo
      .replace(/\/$/, '') || '/';
    const search = parsed.search;
    const key = origin + path + search;
    if (seen.has(key)) return;
    seen.add(key);

    const rawLabel = cleanLabel($(elEl).text());
    if (!rawLabel || rawLabel.length < 1 || rawLabel.length > 60) return;

    const depth = path === '/' ? 0 : path.split('/').length - 1;

    links.push({
      label: rawLabel,
      url: key,
      path,
      search,
      depth,
      inNavContext: isNavContext($, elEl),
    });
  });

  return links;
}

// ─── Strategy 1: Child-path tabs ─────────────────────────────────────────────

function childPathStrategy(links: LinkInfo[], basePath: string, baseDepth: number): SectionGroup | null {
  if (!basePath || basePath === '/') return null;
  const prefix = basePath + '/';
  const children = links.filter(
    (l) => l.path.startsWith(prefix) && l.depth === baseDepth + 1,
  );
  if (children.length < 2) return null;
  const navBonus = children.filter((l) => l.inNavContext).length / children.length;
  return {
    links: children.map((l) => ({ label: l.label, url: l.url })),
    score: children.length * 3 + navBonus * 10 + 5, // child-path gets base +5
    strategy: 'child-path',
  };
}

// ─── Strategy 2: Nav/tab context group ───────────────────────────────────────
// Find the largest cluster of links sharing the same URL prefix inside a nav context.

function navContextStrategy(links: LinkInfo[], basePath: string): SectionGroup | null {
  const navLinks = links.filter((l) => l.inNavContext);
  if (navLinks.length < 3) return null;

  // Group by parent-dir prefix
  const prefixMap = new Map<string, LinkInfo[]>();
  for (const link of navLinks) {
    const parts = link.path.split('/');
    const prefix = parts.slice(0, -1).join('/') || '/';
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(link);
  }

  // Pick the biggest group (min 2 items)
  let best: { prefix: string; items: LinkInfo[] } | null = null;
  for (const [prefix, items] of prefixMap) {
    if (items.length < 2) continue;
    if (!best || items.length > best.items.length) best = { prefix, items };
  }
  if (!best) return null;

  // Prefer the group whose prefix starts with / matches the basePath if possible
  for (const [prefix, items] of prefixMap) {
    if (items.length < 2) continue;
    if (basePath !== '/' && (prefix === basePath || prefix.startsWith(basePath + '/'))) {
      if (items.length >= best.items.length - 1) { best = { prefix, items }; break; }
    }
  }

  const { items } = best;
  const currentPathBonus = (basePath !== '/' && best.prefix.startsWith(basePath)) ? 8 : 0;
  return {
    links: items.map((l) => ({ label: l.label, url: l.url })),
    score: items.length * 2 + 5 + currentPathBonus,
    strategy: 'nav-context',
  };
}

// ─── Strategy 3: Query-param categories ──────────────────────────────────────
// e.g. /products?category=shirts, /products?category=pants  (same path, one varying param)

function queryParamStrategy(links: LinkInfo[], basePath: string): SectionGroup | null {
  // Only consider links on the same base path
  const samePath = links.filter((l) => l.path === basePath && l.search);
  if (samePath.length < 3) return null;

  // Find a single query param that varies across all links
  const paramMap = new Map<string, Set<string>>(); // paramName → set of values
  for (const link of samePath) {
    const params = new URLSearchParams(link.search);
    params.forEach((val, key) => {
      if (!paramMap.has(key)) paramMap.set(key, new Set());
      paramMap.get(key)!.add(val);
    });
  }

  let bestParam: string | null = null;
  let bestCount = 0;
  for (const [param, vals] of paramMap) {
    if (vals.size > bestCount) { bestParam = param; bestCount = vals.size; }
  }
  if (!bestParam || bestCount < 3) return null;

  const items = samePath.filter((l) => new URLSearchParams(l.search).has(bestParam!));
  return {
    links: items.map((l) => ({ label: l.label, url: l.url })),
    score: items.length * 2 + 3,
    strategy: `query-param:${bestParam}`,
  };
}

// ─── Strategy 4: Top-level nav (homepage) ────────────────────────────────────

function topLevelNavStrategy(links: LinkInfo[], basePath: string): SectionGroup | null {
  // Only sensible when on the homepage or a very shallow path
  if (basePath !== '/' && basePath !== '') return null;
  const topLinks = links.filter((l) => l.inNavContext && l.depth === 1);
  if (topLinks.length < 3) return null;

  // Group by first path segment
  const segMap = new Map<string, LinkInfo[]>();
  for (const l of topLinks) {
    const seg = l.path.split('/')[1] || '';
    if (!segMap.has(seg)) segMap.set(seg, []);
    segMap.get(seg)!.push(l);
  }

  // Pick unique first-segment links
  const unique: LinkInfo[] = [];
  for (const [, items] of segMap) unique.push(items[0]);

  if (unique.length < 3) return null;
  return {
    links: unique.map((l) => ({ label: l.label, url: l.url })),
    score: unique.length * 1.5 + 1,
    strategy: 'top-level-nav',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

try {
  const page = await fetchPage(inputUrl, { fetchMode: mode });
  const $ = cheerio.load(page.html);

  const parsed = new URL(page.url);
  const basePath = parsed.pathname.replace(/\/$/, '') || '/';
  const baseDepth = basePath === '/' ? 0 : basePath.split('/').length - 1;
  const origin = parsed.origin;

  // Skip the current page from candidates
  const allLinks = collectLinks($, page.url, origin).filter(
    (l) => l.path !== basePath || l.search !== '',
  );

  // Run all strategies
  const candidates: SectionGroup[] = [
    childPathStrategy(allLinks, basePath, baseDepth),
    navContextStrategy(allLinks, basePath),
    queryParamStrategy(allLinks, basePath),
    topLevelNavStrategy(allLinks, basePath),
  ].filter((g): g is SectionGroup => g !== null);

  // Pick winner (highest score)
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0] ?? null;

  // Deduplicate winner links
  const sections: SectionLink[] = winner
    ? winner.links.filter((l, i) => winner.links.findIndex((x) => x.url === l.url) === i)
    : [];

  process.stdout.write(JSON.stringify({
    ok: true,
    url: page.url,
    fetchMode: page.fetchMode,
    hasSections: sections.length >= 2,
    detectionStrategy: winner?.strategy ?? null,
    sections,
  }, null, 2) + '\n');

} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}
