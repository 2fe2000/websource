import { fetchStatic, type FetchResult } from './static-fetcher.js';
import { fetchRendered } from './rendered-fetcher.js';
import { createChildLogger } from '../shared/logger.js';
import * as cheerio from 'cheerio';

const log = createChildLogger('fetcher');

export interface PageContent {
  html: string;
  url: string;
  fetchMode: 'static' | 'rendered';
  fetchTimeMs: number;
  renderingScore?: number;
  renderingReasons?: string[];
}

// Multi-signal scoring system to decide if a page needs browser rendering.
// Returns score 0-1; threshold 0.4 triggers Playwright.
function scoreRenderingNeed(html: string): { score: number; reasons: string[] } {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().trim();
  const totalHtml = html.length;
  let score = 0;
  const reasons: string[] = [];

  // Signal 1 (existing): near-empty body + many scripts
  const hasScripts = $('script[src]').length > 3;
  if (bodyText.length < 200 && hasScripts) {
    score += 0.5;
    reasons.push('empty-body-with-scripts');
  }

  // Signal 2 (existing): SPA framework root markers
  const spaMarkers = ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', '[ng-app]'];
  for (const sel of spaMarkers) {
    if ($(sel).length > 0) {
      score += 0.4;
      reasons.push(`spa-marker:${sel}`);
      break;
    }
  }

  // Signal 3 (existing): Vue data-v- attribute
  if (html.includes('data-v-')) {
    score += 0.3;
    reasons.push('vue-data-v');
  }

  // Signal 4 (new): Definitive Next.js markers
  if ($('meta[name="next-head-count"]').length > 0) {
    score += 0.4;
    reasons.push('next-head-count-meta');
  }

  // Signal 5 (new): SSR hydration globals in inline scripts
  const inlineScripts = $('script:not([src])').map((_, el) => $(el).html() || '').get().join(' ');
  if (/__NEXT_DATA__|window\.__NEXT_DATA__/.test(inlineScripts)) {
    score += 0.5;
    reasons.push('__NEXT_DATA__-hydration');
  }
  if (/__NUXT__|window\.__NUXT__/.test(inlineScripts)) {
    score += 0.4;
    reasons.push('__NUXT__-hydration');
  }
  if (/__GATSBY__|window\.___gatsby/.test(inlineScripts)) {
    score += 0.4;
    reasons.push('__GATSBY__-hydration');
  }

  // Signal 6 (new): JS bundle chunk patterns (Next.js / CRA / Vite)
  const scriptSrcs = $('script[src]').map((_, el) => $(el).attr('src') || '').get().join(' ');
  if (/\/_next\/|\/chunks\/|runtime[-.].*\.js|app[-.].*\.js/.test(scriptSrcs)) {
    score += 0.3;
    reasons.push('js-bundle-chunks');
  }

  // Signal 7 (new): Explicit JS requirement notice
  if ($('noscript').text().toLowerCase().includes('javascript')) {
    score += 0.5;
    reasons.push('noscript-javascript-required');
  }

  // Signal 8 (new): Very low text-to-HTML ratio (content hidden in JS)
  if (totalHtml > 0 && bodyText.length / totalHtml < 0.05 && totalHtml > 2000) {
    score += 0.2;
    reasons.push('low-text-to-html-ratio');
  }

  return { score: Math.min(score, 1), reasons };
}

// After a static fetch, check if the field detection result is too poor to use.
// Returns true if the static result is usable (don't need re-fetch).
function staticResultHasContent(html: string): boolean {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().trim();
  // If body text is extremely thin, the page likely didn't render
  return bodyText.length >= 300;
}

export async function fetchPage(
  url: string,
  options?: {
    fetchMode?: 'static' | 'rendered' | 'auto';
    timeoutMs?: number;
    maxRetries?: number;
    userAgent?: string;
    waitFor?: string;
    // Called after static fetch — return false to force rendered retry
    onStaticResult?: (html: string) => boolean;
  },
): Promise<PageContent> {
  const mode = options?.fetchMode ?? 'auto';

  if (mode === 'rendered') {
    const result = await fetchRendered(url, {
      timeoutMs: options?.timeoutMs,
      userAgent: options?.userAgent,
      waitFor: options?.waitFor,
    });
    return { html: result.html, url: result.url, fetchMode: 'rendered', fetchTimeMs: result.fetchTimeMs };
  }

  // Static first
  const staticResult = await fetchStatic(url, options);

  if (mode === 'static') {
    return { html: staticResult.html, url: staticResult.url, fetchMode: 'static', fetchTimeMs: staticResult.fetchTimeMs };
  }

  // Auto mode: multi-signal scoring
  const { score, reasons } = scoreRenderingNeed(staticResult.html);

  // Check explicit content quality (caller hook or built-in heuristic)
  const callerSaysOk = options?.onStaticResult ? options.onStaticResult(staticResult.html) : true;
  const contentIsUsable = staticResultHasContent(staticResult.html);

  const shouldRender = score >= 0.4 || !callerSaysOk || !contentIsUsable;

  if (shouldRender) {
    log.info({ url, score, reasons, callerSaysOk, contentIsUsable }, 'Switching to rendered fetch');
    try {
      const renderedResult = await fetchRendered(url, {
        timeoutMs: options?.timeoutMs,
        userAgent: options?.userAgent,
        waitFor: options?.waitFor,
      });
      return {
        html: renderedResult.html,
        url: renderedResult.url,
        fetchMode: 'rendered',
        fetchTimeMs: renderedResult.fetchTimeMs,
        renderingScore: score,
        renderingReasons: reasons,
      };
    } catch (error) {
      log.warn({ url, error }, 'Rendered fetch failed, falling back to static result');
    }
  }

  return {
    html: staticResult.html,
    url: staticResult.url,
    fetchMode: 'static',
    fetchTimeMs: staticResult.fetchTimeMs,
    renderingScore: score,
    renderingReasons: reasons.length > 0 ? reasons : undefined,
  };
}
