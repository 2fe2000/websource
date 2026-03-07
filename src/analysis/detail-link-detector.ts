import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { DetailLinkHint, RepeatedBlock } from '../shared/types.js';
import { resolveAbsoluteUrl } from '../shared/utils.js';
import { DEFAULTS } from '../config/defaults.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('detail-link-detector');

export function detectDetailLinks(html: string, block: RepeatedBlock, baseUrl: string): DetailLinkHint[] {
  const $ = cheerio.load(html);
  const items = $(block.selector).toArray().filter((el): el is Element => el.type === 'tag');
  const sampleItems = items.slice(0, DEFAULTS.sampleSize);

  if (sampleItems.length === 0) return [];

  const candidates = new Map<string, { urls: string[]; totalScore: number; count: number }>();

  for (const item of sampleItems) {
    const $item = $(item);
    const links = $item.find('a[href]').toArray();

    for (const link of links) {
      const href = $(link).attr('href');
      if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

      const absUrl = resolveAbsoluteUrl(href, baseUrl);
      if (!absUrl) continue;

      let score = 0;

      // Heuristic: link wraps or is inside a heading
      if ($(link).find('h1,h2,h3,h4,h5,h6').length > 0 || $(link).closest('h1,h2,h3,h4,h5,h6').length > 0) {
        score += 0.3;
      }

      // Heuristic: link text is substantial
      const text = $(link).text().trim();
      if (text.length > 10 && text.length < 200) score += 0.2;

      // Heuristic: URL looks like a detail page
      if (/\/[a-z0-9-]+\/[a-z0-9-]{3,}$/i.test(absUrl) || /\/\d+$/.test(absUrl)) {
        score += 0.25;
      }

      // Heuristic: first link in item
      if (links.indexOf(link) === 0) score += 0.1;

      // Heuristic: class suggests primary link
      const cls = $(link).attr('class') || '';
      if (/title|main|primary|detail|more/i.test(cls)) score += 0.15;

      // Build relative selector
      const tag = link.tagName;
      const linkCls = $(link).attr('class');
      let relSel: string;
      if (linkCls) {
        const classes = linkCls.trim().split(/\s+/).slice(0, 2).join('.');
        relSel = `a.${classes}`;
      } else {
        const parent = $(link).parent();
        const parentTag = parent.get(0) as Element | undefined;
        if (parentTag?.type === 'tag' && /^h[1-6]$/.test(parentTag.tagName)) {
          relSel = `${parentTag.tagName} > a`;
        } else {
          relSel = 'a[href]';
        }
      }

      if (!candidates.has(relSel)) {
        candidates.set(relSel, { urls: [], totalScore: 0, count: 0 });
      }
      const entry = candidates.get(relSel)!;
      entry.urls.push(absUrl);
      entry.totalScore += score;
      entry.count++;
    }
  }

  const hints: DetailLinkHint[] = [];
  for (const [selector, data] of candidates) {
    const avgScore = data.totalScore / data.count;
    const hitRate = data.count / sampleItems.length;

    if (hitRate < 0.5) continue;

    hints.push({
      selector,
      sampleUrls: [...new Set(data.urls)].slice(0, 5),
      confidence: Math.min(avgScore * hitRate + 0.1, 1),
    });
  }

  hints.sort((a, b) => b.confidence - a.confidence);
  log.debug({ hintCount: hints.length }, 'Detail link hints detected');
  return hints;
}
