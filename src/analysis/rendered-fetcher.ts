import type { Page } from 'playwright';
import { NetworkError, TimeoutError } from '../shared/errors.js';
import { createChildLogger } from '../shared/logger.js';
import { DEFAULTS } from '../config/defaults.js';

const log = createChildLogger('rendered-fetcher');

export interface RenderedFetchResult {
  html: string;
  url: string;
  fetchTimeMs: number;
  stabilizationMs: number;
  finalTextLength: number;
}

let _playwright: typeof import('playwright') | undefined;

async function getPlaywright() {
  if (!_playwright) {
    _playwright = await import('playwright');
  }
  return _playwright;
}

// Framework-specific content selectors to verify the page has rendered
const FRAMEWORK_CONTENT_SELECTORS: string[] = [
  '#__next > *:not(:empty)',   // Next.js
  '#root > *:not(:empty)',     // React CRA
  '#app > *:not(:empty)',      // Vue / generic
  '#__nuxt > *:not(:empty)',   // Nuxt
];

async function waitForFrameworkContent(page: Page, timeoutMs: number): Promise<void> {
  for (const selector of FRAMEWORK_CONTENT_SELECTORS) {
    try {
      const found = await page.$(selector);
      if (found) {
        await page.waitForSelector(selector, { timeout: timeoutMs }).catch(() => {});
        return;
      }
    } catch {
      // ignore
    }
  }
}

async function waitForContentStable(
  page: Page,
  opts: { maxWaitMs: number; minTextLength: number },
): Promise<number> {
  const { maxWaitMs, minTextLength } = opts;
  const start = Date.now();
  const readings: number[] = [];

  // Track new JSON responses (SWR / React Query data fetching signals)
  let pendingDataRequests = 0;
  page.on('response', (res) => {
    const ct = res.headers()['content-type'] ?? '';
    if (ct.includes('application/json')) {
      pendingDataRequests++;
      setTimeout(() => { pendingDataRequests = Math.max(0, pendingDataRequests - 1); }, 800);
    }
  });

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 300));

    let textLen = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
    textLen = await page.evaluate('document.body?.innerText?.length ?? 0') as number;
    } catch {
      break;
    }

    // Reset readings if there are pending data fetches
    if (pendingDataRequests > 0) {
      readings.length = 0;
      continue;
    }

    readings.push(textLen);

    if (readings.length >= 3 && textLen >= minTextLength) {
      const last3 = readings.slice(-3);
      const max = Math.max(...last3);
      const min = Math.min(...last3);
      // Stable = all 3 within 5% of each other
      if (max === 0 || (max - min) / max <= 0.05) {
        break;
      }
    }
  }

  return Date.now() - start;
}

export async function fetchRendered(
  url: string,
  options?: {
    timeoutMs?: number;
    userAgent?: string;
    waitFor?: string;
    minContentLength?: number;
    maxStabilizationMs?: number;
  },
): Promise<RenderedFetchResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULTS.timeoutMs;
  const userAgent = options?.userAgent ?? DEFAULTS.userAgent;
  const minTextLength = options?.minContentLength ?? 500;
  const maxStabilizationMs = options?.maxStabilizationMs ?? 8000;

  const start = Date.now();
  const pw = await getPlaywright();

  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    // Wait for framework-specific content to appear
    await waitForFrameworkContent(page, 5000);

    // Wait for user-specified selector
    if (options?.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 }).catch(() => {});
    }

    // Smart content stabilization (replaces hardcoded 1s wait)
    const stabilizationMs = await waitForContentStable(page, { maxWaitMs: maxStabilizationMs, minTextLength });

    const html = await page.content();
    const finalTextLength = await (page.evaluate('document.body?.innerText?.length ?? 0') as Promise<number>).catch(() => 0);
    const fetchTimeMs = Date.now() - start;

    log.debug({ url, fetchTimeMs, stabilizationMs, htmlLength: html.length, finalTextLength }, 'Rendered fetch complete');

    return { html, url, fetchTimeMs, stabilizationMs, finalTextLength };
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('Timeout') || msg.includes('timeout')) {
      throw new TimeoutError(`Rendered fetch timed out after ${timeoutMs}ms: ${url}`);
    }
    throw new NetworkError(`Rendered fetch failed for ${url}: ${msg}`, error as Error);
  } finally {
    await browser?.close();
  }
}

export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const pw = await getPlaywright();
    const browser = await pw.chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
