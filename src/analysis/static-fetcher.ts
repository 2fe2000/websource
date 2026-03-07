import { NetworkError, ParseError, TimeoutError } from '../shared/errors.js';
import { withRetry } from '../shared/retry.js';
import { DEFAULTS } from '../config/defaults.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('static-fetcher');

export interface FetchResult {
  html: string;
  statusCode: number;
  url: string;
  redirectedUrl?: string;
  fetchTimeMs: number;
}

export async function fetchStatic(
  url: string,
  options?: { timeoutMs?: number; maxRetries?: number; userAgent?: string; maxResponseBytes?: number },
): Promise<FetchResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = options?.maxRetries ?? DEFAULTS.maxRetries;
  const userAgent = options?.userAgent ?? DEFAULTS.userAgent;

  return withRetry(
    async () => {
      const start = Date.now();
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          throw new NetworkError(`HTTP ${response.status}: ${response.statusText} for ${url}`);
        }

        const html = await response.text();
        const maxBytes = options?.maxResponseBytes ?? DEFAULTS.maxResponseBytes;
        if (html.length > maxBytes) {
          throw new ParseError(`Response too large: ${html.length} bytes exceeds limit of ${maxBytes}`);
        }
        const fetchTimeMs = Date.now() - start;

        log.debug({ url, statusCode: response.status, fetchTimeMs, htmlLength: html.length }, 'Static fetch complete');

        return {
          html,
          statusCode: response.status,
          url,
          redirectedUrl: response.url !== url ? response.url : undefined,
          fetchTimeMs,
        };
      } catch (error) {
        if (error instanceof NetworkError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new TimeoutError(`Fetch timed out after ${timeoutMs}ms: ${url}`);
        }
        throw new NetworkError(`Failed to fetch ${url}: ${(error as Error).message}`, error as Error);
      }
    },
    {
      maxRetries,
      shouldRetry: (err) => {
        if (err instanceof TimeoutError) return true;
        if (err instanceof NetworkError) return true;
        return false;
      },
    },
  );
}
