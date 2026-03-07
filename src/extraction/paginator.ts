import * as cheerio from 'cheerio';
import type { PaginationConfig } from '../shared/types.js';
import { resolveAbsoluteUrl } from '../shared/utils.js';

export function resolveNextPageUrl(
  html: string,
  pagination: PaginationConfig | undefined,
  currentUrl: string,
  currentPage: number,
): string | null {
  if (!pagination) return null;
  if (currentPage >= pagination.maxPages) return null;

  const $ = cheerio.load(html);

  switch (pagination.strategy) {
    case 'next-link': {
      if (!pagination.nextSelector) return null;
      const nextEl = $(pagination.nextSelector).first();
      const href = nextEl.attr('href');
      if (!href) return null;
      return resolveAbsoluteUrl(href, currentUrl);
    }

    case 'page-param': {
      if (!pagination.paramName) return null;
      try {
        const url = new URL(currentUrl);
        const nextValue = (pagination.startValue ?? 1) + currentPage * (pagination.increment ?? 1);
        url.searchParams.set(pagination.paramName, String(nextValue));
        return url.href;
      } catch {
        return null;
      }
    }

    case 'offset-param': {
      if (!pagination.paramName) return null;
      try {
        const url = new URL(currentUrl);
        const nextValue = (pagination.startValue ?? 0) + currentPage * (pagination.increment ?? 20);
        url.searchParams.set(pagination.paramName, String(nextValue));
        return url.href;
      } catch {
        return null;
      }
    }

    default:
      return null;
  }
}
