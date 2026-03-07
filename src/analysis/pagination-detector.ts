import * as cheerio from 'cheerio';
import type { PaginationHint } from '../shared/types.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('pagination-detector');

export function detectPagination(html: string, currentUrl: string): PaginationHint[] {
  const $ = cheerio.load(html);
  const hints: PaginationHint[] = [];

  // Strategy 1: rel="next" link
  const relNext = $('a[rel="next"]').first();
  if (relNext.length && relNext.attr('href')) {
    hints.push({
      strategy: 'next-link',
      selector: 'a[rel="next"]',
      urlPattern: relNext.attr('href'),
      confidence: 0.95,
    });
  }

  // Strategy 2: Common "next" patterns
  const nextSelectors = [
    'a[aria-label*="next" i]',
    '.pagination a.next',
    '.pager a.next',
    'a.next-page',
    '[class*="pagination"] a:last-child',
  ];

  if (hints.length === 0) {
    for (const sel of nextSelectors) {
      const el = $(sel).first();
      if (el.length && el.attr('href')) {
        hints.push({
          strategy: 'next-link',
          selector: sel,
          urlPattern: el.attr('href'),
          confidence: 0.7,
        });
        break;
      }
    }
  }

  // Strategy 3: Text-based next detection
  if (hints.length === 0) {
    $('a').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const href = $(el).attr('href');
      if (!href) return;
      if (['next', 'next page', '>', '>>', '»', '›', 'next ›'].includes(text)) {
        hints.push({
          strategy: 'next-link',
          selector: buildAnchorSelector($, el),
          urlPattern: href,
          confidence: 0.65,
        });
        return false; // break
      }
    });
  }

  // Strategy 4: Page number pattern in pagination container
  const paginationContainers = $('nav[aria-label*="pag" i], .pagination, .pager, [class*="pagina"]');
  if (paginationContainers.length) {
    const links = paginationContainers.first().find('a[href]').toArray();
    const hrefs = links.map((l) => $(l).attr('href')!).filter(Boolean);

    const pattern = detectPageParamPattern(hrefs, currentUrl);
    if (pattern) {
      hints.push({
        strategy: 'page-param',
        selector: buildSelector($, paginationContainers.get(0)!) + ' a',
        urlPattern: pattern,
        confidence: 0.85,
      });
    }
  }

  // Strategy 5: Load more / infinite scroll
  const loadMoreSelectors = [
    'button:contains("Load more")', 'button:contains("Show more")',
    'a:contains("Load more")', '[class*="load-more"]', '[class*="show-more"]',
  ];
  for (const sel of loadMoreSelectors) {
    if ($(sel).length) {
      hints.push({ strategy: 'infinite-scroll', selector: sel, confidence: 0.6 });
      break;
    }
  }

  hints.sort((a, b) => b.confidence - a.confidence);
  log.debug({ hintCount: hints.length }, 'Pagination hints detected');
  return hints;
}

function detectPageParamPattern(hrefs: string[], currentUrl: string): string | undefined {
  try {
    const parsed = hrefs.map((h) => new URL(h, currentUrl));
    for (const param of ['page', 'p', 'pg', 'offset', 'start']) {
      const vals = parsed.map((u) => u.searchParams.get(param)).filter(Boolean);
      if (vals.length >= 2 && vals.every((v) => /^\d+$/.test(v!))) {
        return `${param}={{page}}`;
      }
    }
  } catch {}
  return undefined;
}

function buildSelector($: cheerio.CheerioAPI, el: any): string {
  const tag = el.tagName || 'div';
  const cls = $(el).attr('class');
  if (cls) return `${tag}.${cls.trim().split(/\s+/).slice(0, 2).join('.')}`;
  return tag;
}

function buildAnchorSelector($: cheerio.CheerioAPI, el: any): string {
  const cls = $(el).attr('class');
  if (cls) return `a.${cls.trim().split(/\s+/).slice(0, 2).join('.')}`;
  const parent = $(el).parent();
  const parentCls = parent.attr('class');
  if (parentCls) return `.${parentCls.trim().split(/\s+/)[0]} > a`;
  return 'a';
}
