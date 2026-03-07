import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { RepeatedBlock, PageType } from '../shared/types.js';
import { DEFAULTS } from '../config/defaults.js';
import { truncate } from '../shared/utils.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('dom-analyzer');

interface DOMFingerprint {
  tagSequence: string;
  depth: number;
  childCount: number;
  hasImage: boolean;
  hasLink: boolean;
  hasTestId: boolean;
  hasItemprop: boolean;
  hasTime: boolean;
}

function buildTagSequence(el: Element, $: CheerioAPI, depth: number, maxDepth: number): string {
  if (depth >= maxDepth || el.type !== 'tag') return '';
  const children = $(el).children().toArray().filter((c): c is Element => c.type === 'tag');
  if (children.length === 0) return el.tagName;
  const childSeqs = children.map((c) => buildTagSequence(c, $, depth + 1, maxDepth));
  return el.tagName + '>' + childSeqs.join('+');
}

function computeFingerprint($: CheerioAPI, el: Element): DOMFingerprint {
  const tagSeq = buildTagSequence(el, $, 0, 4);
  return {
    tagSequence: tagSeq,
    depth: measureDepth($, el, 4),
    childCount: $(el).children().length,
    hasImage: $(el).find('img').length > 0,
    hasLink: $(el).find('a[href]').length > 0,
    hasTestId: $(el).find('[data-testid]').length > 0 || !!$(el).attr('data-testid'),
    hasItemprop: $(el).find('[itemprop]').length > 0,
    hasTime: $(el).find('time').length > 0,
  };
}

function measureDepth($: CheerioAPI, el: Element, maxDepth: number, current = 0): number {
  if (current >= maxDepth) return current;
  const children = $(el).children().toArray().filter((c): c is Element => c.type === 'tag');
  if (children.length === 0) return current;
  return Math.max(...children.map((c) => measureDepth($, c, maxDepth, current + 1)));
}

function serializeFingerprint(fp: DOMFingerprint): string {
  const flags = [fp.hasImage, fp.hasLink, fp.hasTime, fp.hasItemprop].map(Number).join('');
  return `${fp.tagSequence}|${fp.childCount}|${flags}`;
}

// Returns true if a CSS class name carries semantic meaning (not Tailwind atomic / CSS-in-JS hash)
function isSemanticClass(cls: string): boolean {
  // Tailwind atomic utilities
  if (/^(flex|grid|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min|max|text|font|bg|border|rounded|shadow|overflow|items|justify|space|col|row|z|top|left|right|bottom|inset|opacity|cursor|select|pointer|transition|duration|ease|transform|scale|rotate|translate|sr|not|hidden|block|inline|relative|absolute|fixed|sticky|float|clear|object|aspect|leading|tracking|align|whitespace|break|truncate|ring|outline|appearance|resize|order|grow|shrink|basis|self|place|content|divide|display)-/.test(cls)) return false;
  // Single-char Tailwind: p-4, m-2, etc.
  if (/^[a-z]-\d/.test(cls)) return false;
  // CSS-in-JS hashed classes: css-abc123, sc-xyz789
  if (/^css-[a-z0-9]{4,}$/i.test(cls)) return false;
  if (/^sc-[a-z0-9]{4,}$/i.test(cls)) return false;
  // Emotion/styled-components runtime hashes
  if (/^[a-z]{1,3}-[a-zA-Z0-9]{6,}$/.test(cls)) return false;
  return true;
}

function buildSelector($: CheerioAPI, el: Element): string {
  const tag = el.tagName;
  const id = $(el).attr('id');
  if (id) return `${tag}#${id}`;

  // Prefer data-testid (stable across deploys)
  const testId = $(el).attr('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // Prefer itemtype (microdata)
  const itemtype = $(el).attr('itemtype');
  if (itemtype) return `[itemtype="${itemtype}"]`;

  // Filter to semantic class names only (exclude Tailwind/CSS-in-JS)
  const cls = $(el).attr('class');
  if (cls) {
    const semanticClasses = cls.trim().split(/\s+/).filter((c) => c.length > 0 && isSemanticClass(c)).slice(0, 3);
    if (semanticClasses.length > 0) return `${tag}.${semanticClasses.join('.')}`;
  }

  // Fall back to parent context for specificity when tag alone is ambiguous
  const parent = $(el).parent();
  if (parent.length) {
    const parentEl = parent.get(0) as Element | undefined;
    if (parentEl?.type === 'tag') {
      const parentId = $(parentEl).attr('id');
      if (parentId) return `${parentEl.tagName}#${parentId} > ${tag}`;
      const parentTestId = $(parentEl).attr('data-testid');
      if (parentTestId) return `[data-testid="${parentTestId}"] > ${tag}`;
      const parentCls = $(parentEl).attr('class')?.trim().split(/\s+/).filter((c) => c.length > 0 && isSemanticClass(c)).slice(0, 2).join('.');
      if (parentCls) return `${parentEl.tagName}.${parentCls} > ${tag}`;
    }
  }

  return tag;
}

// Build a simple child-only selector (no parent context) for use inside buildItemSelector
function buildChildSelector($: CheerioAPI, el: Element): string {
  const tag = el.tagName;

  const testId = $(el).attr('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  const itemtype = $(el).attr('itemtype');
  if (itemtype) return `[itemtype="${itemtype}"]`;

  const cls = $(el).attr('class');
  if (cls) {
    const semanticClasses = cls.trim().split(/\s+/).filter((c) => c.length > 0 && isSemanticClass(c)).slice(0, 3);
    if (semanticClasses.length > 0) return `${tag}.${semanticClasses.join('.')}`;
  }

  return tag;
}

function buildItemSelector($: CheerioAPI, el: Element, parent: Element): string {
  const parentSel = buildSelector($, parent);
  const childSel = buildChildSelector($, el);
  return `${parentSel} > ${childSel}`;
}

function computeGroupConfidence(elements: Element[], $: CheerioAPI): number {
  let confidence = 0;
  const count = elements.length;

  // More items = higher confidence
  if (count >= 10) confidence += 0.3;
  else if (count >= 5) confidence += 0.25;
  else if (count >= 3) confidence += 0.15;

  // Items with links = strong list signal
  const withLinks = elements.filter((el) => $(el).find('a[href]').length > 0).length;
  if (withLinks / count > 0.8) confidence += 0.2;

  // Items with images
  const withImages = elements.filter((el) => $(el).find('img').length > 0).length;
  if (withImages / count > 0.5) confidence += 0.15;

  // Text variety (items should have different text)
  const texts = new Set(elements.map((el) => $(el).text().trim().slice(0, 100)));
  if (texts.size / count > 0.7) confidence += 0.2;

  // Structural depth (deeper = more meaningful)
  const fp = computeFingerprint($, elements[0]);
  if (fp.depth >= 2) confidence += 0.15;
  else if (fp.depth < 1) confidence -= 0.2; // Penalty for leaf/shallow elements

  // Minimum text length — filter out icon-only or trivially empty items
  const avgTextLen = elements.reduce((s, el) => s + $(el).text().trim().length, 0) / count;
  if (avgTextLen < 5) confidence -= 0.3; // Icon-only blocks
  else if (avgTextLen > 20) confidence += 0.1;

  // Boost items that contain or are semantic content tags (article, section, card)
  const firstEl = elements[0];
  const firstTag = firstEl.tagName;
  if (firstTag === 'article') confidence += 0.2;
  const hasArticle = $(firstEl).find('article').length > 0;
  if (hasArticle) confidence += 0.15;
  const firstCls = $(firstEl).attr('class') || '';
  if (/card|product|item|listing|result|entry/i.test(firstCls)) confidence += 0.15;

  // Boost: microdata presence is a strong structured data signal
  const withItemprop = elements.filter((el) => $(el).find('[itemprop]').length > 0).length;
  if (withItemprop / count > 0.5) confidence += 0.2;

  // Boost: consistent data-testid suggests intentional data structure
  const testIds = elements.map((el) => $(el).attr('data-testid') || '').filter(Boolean);
  if (testIds.length > 0) {
    const uniqueTestIds = new Set(testIds);
    if (uniqueTestIds.size === 1) confidence += 0.15;
    else if (uniqueTestIds.size <= 2) confidence += 0.1;
  }

  return Math.min(Math.max(confidence, 0), 1);
}

export function detectRepeatedBlocks(html: string): RepeatedBlock[] {
  const $ = cheerio.load(html);
  const groups: RepeatedBlock[] = [];

  // Find all container candidates: elements with >= 3 children of the same tag
  const containers: Element[] = [];
  $('body *').each((_, el) => {
    if (el.type !== 'tag') return;
    const children = $(el).children().toArray().filter((c): c is Element => c.type === 'tag');
    if (children.length < DEFAULTS.minRepeatedBlocks) return;

    const tagCounts = new Map<string, number>();
    for (const c of children) {
      if (c.type !== 'tag') continue;
      tagCounts.set(c.tagName, (tagCounts.get(c.tagName) || 0) + 1);
    }
    const maxTagCount = Math.max(...tagCounts.values());
    if (maxTagCount >= DEFAULTS.minRepeatedBlocks) containers.push(el);
  });

  // Prefer deepest containers (most specific)
  const filtered = filterToDeepest($, containers);

  for (const container of filtered) {
    const children = $(container).children().toArray().filter((c): c is Element => c.type === 'tag');

    // Group children by structural fingerprint
    const fpMap = new Map<string, Element[]>();
    for (const child of children) {
      const fp = computeFingerprint($, child);
      const key = serializeFingerprint(fp);
      if (!fpMap.has(key)) fpMap.set(key, []);
      fpMap.get(key)!.push(child);
    }

    for (const [fpKey, elements] of fpMap) {
      if (elements.length < DEFAULTS.minRepeatedBlocks) continue;

      const selector = buildItemSelector($, elements[0], container);
      const parentSelector = buildSelector($, container);
      const confidence = computeGroupConfidence(elements, $);
      const sampleHtml = $.html(elements[0]) ?? '';

      groups.push({
        selector,
        parentSelector,
        count: elements.length,
        sampleHtml: truncate(sampleHtml, 500),
        confidence,
        fingerprint: fpKey,
      });
    }
  }

  // Filter out low-confidence noise (icons, decorative elements)
  const meaningful = groups.filter((g) => g.confidence >= 0.2);

  // Sort by score: confidence is primary, count provides diminishing returns via log
  // This prevents high-count but low-quality blocks (nav lists) from outranking content
  meaningful.sort((a, b) => {
    const scoreA = a.confidence * 10 + Math.log2(a.count);
    const scoreB = b.confidence * 10 + Math.log2(b.count);
    return scoreB - scoreA;
  });
  const result = meaningful.slice(0, 10);

  log.debug({ blockCount: result.length, totalCandidates: groups.length }, 'Repeated blocks detected');
  return result;
}

function filterToDeepest($: CheerioAPI, elements: Element[]): Element[] {
  return elements.filter((el) => {
    // Remove a container only if a direct child of it is also a container candidate
    // (not deeply nested descendants like star-rating icons inside product items)
    const children = $(el).children().toArray();
    return !elements.some((other) => other !== el && children.includes(other));
  });
}

export function classifyPage(html: string, url: string, precomputedBlocks?: RepeatedBlock[]): { type: PageType; confidence: number } {
  const $ = cheerio.load(html);
  const signals: Array<{ type: PageType; weight: number }> = [];

  // Signal: repeated blocks (use precomputed if available)
  const blocks = precomputedBlocks ?? detectRepeatedBlocks(html);
  const bestBlock = blocks[0];
  if (bestBlock && bestBlock.count >= 5) {
    signals.push({ type: 'list', weight: 0.4 });
  }

  // Signal: URL patterns
  if (/\/(products|listings|items|search|category|results|jobs|directory|catalog)\b/i.test(url)) {
    signals.push({ type: 'list', weight: 0.2 });
  }
  if (/\/(product|item|listing|job|post|article)\/[^/]+$/i.test(url)) {
    signals.push({ type: 'detail', weight: 0.25 });
  }

  // Signal: pagination
  const hasPagination = $('nav[aria-label*="pag" i], .pagination, .pager, a[rel="next"]').length > 0;
  if (hasPagination) signals.push({ type: 'list', weight: 0.25 });

  // Signal: article tags
  const articleCount = $('article').length;
  if (articleCount === 1) signals.push({ type: 'article', weight: 0.3 });
  else if (articleCount > 3) signals.push({ type: 'list', weight: 0.2 });

  // Signal: JSON-LD
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html() || '{}');
      const type = data['@type'];
      if (type === 'ItemList' || type === 'SearchResultsPage') signals.push({ type: 'list', weight: 0.3 });
      if (type === 'Product' || type === 'Article') signals.push({ type: 'detail', weight: 0.3 });
    } catch {}
  });

  // Aggregate
  const scores = new Map<PageType, number>();
  for (const s of signals) {
    scores.set(s.type, (scores.get(s.type) || 0) + s.weight);
  }

  let bestType: PageType = 'unknown';
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) { bestType = type; bestScore = score; }
  }

  return { type: bestType, confidence: Math.min(bestScore, 1) };
}
