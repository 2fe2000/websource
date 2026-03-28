import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { SuggestedField, FieldType, RepeatedBlock } from '../shared/types.js';
import { DEFAULTS } from '../config/defaults.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('field-inferrer');

// ─── CSS Rule-based field definitions ────────────────────────────────────────

interface FieldRule {
  name: string;
  selectors: string[];
  attribute?: string;
  type: FieldType;
  contentTest?: (text: string, el: Element, $: CheerioAPI) => boolean;
  priority: number;
}

const FIELD_RULES: FieldRule[] = [
  {
    name: 'title',
    selectors: [
      '[itemprop="name"]', '[itemprop="headline"]',
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]', '[class*="name"]', '[class*="heading"]',
    ],
    type: 'string',
    priority: 1,
  },
  {
    name: 'url',
    // Removed: 'a[href]:first-of-type' — too broad, causes false positives
    selectors: [
      '[itemprop="url"]',
      'h1 a[href]', 'h2 a[href]', 'h3 a[href]', 'h4 a[href]',
      '[class*="title"] a[href]',
    ],
    attribute: 'href',
    type: 'url',
    priority: 2,
  },
  {
    name: 'image',
    selectors: [
      '[itemprop="image"]',
      'img[src]', 'img[data-src]', 'img[data-lazy-src]', 'img[data-original]',
      'picture img', '[class*="image"] img', '[class*="thumb"] img',
    ],
    attribute: 'src',
    type: 'image',
    priority: 3,
  },
  {
    name: 'price',
    selectors: [
      '[itemprop="price"]',
      '[class*="price"]', '[class*="cost"]', '[class*="amount"]',
    ],
    type: 'price',
    contentTest: (text) => /[\$€£¥₹]|USD|EUR|GBP/.test(text) || /^\d[\d,]*\.?\d{0,2}$/.test(text.trim()),
    priority: 4,
  },
  {
    name: 'date',
    selectors: [
      '[itemprop="datePublished"]', '[itemprop="dateCreated"]',
      'time', '[datetime]',
      '[class*="date"]', '[class*="time"]', '[class*="published"]', '[class*="posted"]',
    ],
    type: 'date',
    priority: 5,
  },
  {
    name: 'description',
    selectors: [
      '[itemprop="description"]',
      'p', '[class*="desc"]', '[class*="summary"]', '[class*="excerpt"]', '[class*="snippet"]',
    ],
    type: 'string',
    contentTest: (text) => text.length > 30 && text.length < 1000,
    priority: 6,
  },
  {
    name: 'rating',
    selectors: ['[class*="rating"]', '[class*="stars"]', '[class*="score"]', '[class*="review"]'],
    type: 'number',
    priority: 7,
  },
  {
    name: 'location',
    selectors: ['[class*="location"]', '[class*="address"]', '[class*="city"]'],
    type: 'string',
    priority: 8,
  },
  {
    name: 'category',
    selectors: ['[class*="category"]', '[class*="tag"]', '[class*="label"]'],
    type: 'string',
    priority: 9,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true if a CSS class name carries semantic meaning (not Tailwind atomic / CSS-in-JS hash)
function isSemanticClass(cls: string): boolean {
  // Tailwind responsive/state prefixes: md:, lg:, hover:, focus:, etc.
  if (cls.includes(':')) return false;
  if (/^(flex|grid|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min|max|text|font|bg|border|rounded|shadow|overflow|items|justify|space|col|row|z|top|left|right|bottom|opacity|cursor|transition|transform|scale|rotate|translate|hidden|block|inline|relative|absolute|fixed|sticky)-/.test(cls)) return false;
  // Tailwind arbitrary values: w-[100px], bg-[#fff], etc.
  if (cls.includes('[') || cls.includes(']')) return false;
  if (/^[a-z]-\d/.test(cls)) return false;
  if (/^css-[a-z0-9]{4,}$/i.test(cls)) return false;
  if (/^sc-[a-z0-9]{4,}$/i.test(cls)) return false;
  if (/^[a-z]{1,3}-[a-zA-Z0-9]{6,}$/.test(cls)) return false;
  return true;
}

function buildRelativeSelector($: CheerioAPI, target: Element, root: Element): string {
  const tag = target.tagName;

  // Prefer data-testid (stable)
  const testId = $(target).attr('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // Prefer itemprop
  const itemprop = $(target).attr('itemprop');
  if (itemprop) return `[itemprop="${itemprop}"]`;

  // Semantic class names only
  const cls = $(target).attr('class');
  if (cls) {
    const semanticClasses = cls.trim().split(/\s+/).filter((c) => c.length > 0 && isSemanticClass(c)).slice(0, 2);
    if (semanticClasses.length > 0) {
      const sel = `${tag}.${semanticClasses.join('.')}`;
      if ($(root).find(sel).length === 1) return sel;
    }
  }

  // Tag + position
  const siblings = $(target).parent().children(tag).toArray();
  if (siblings.length === 1) {
    const parentEl = $(target).parent().get(0);
    if (parentEl && parentEl.type === 'tag') {
      const parentCls = $(parentEl).attr('class');
      if (parentCls) {
        const semanticParentCls = parentCls.trim().split(/\s+/).filter((c) => isSemanticClass(c)).slice(0, 2);
        if (semanticParentCls.length > 0) return `${parentEl.tagName}.${semanticParentCls.join('.')} > ${tag}`;
      }
    }
    return tag;
  }

  const idx = siblings.indexOf(target);
  return `${tag}:nth-of-type(${idx + 1})`;
}

function generateFallbackSelectors(rule: FieldRule): string[] {
  const fallbacks: string[] = [];
  switch (rule.name) {
    case 'title': fallbacks.push('h2', 'h3', '[class*="title"]'); break;
    case 'price': fallbacks.push('[class*="price"]', '[class*="cost"]'); break;
    case 'image': fallbacks.push('img[src]', 'img[data-src]'); break;
    case 'date': fallbacks.push('time', '[datetime]', '[class*="date"]'); break;
    case 'url': fallbacks.push('h2 a[href]', 'h3 a[href]'); break;
  }
  return [...new Set(fallbacks)].slice(0, 3);
}

// ─── Priority 0: JSON-LD extraction ──────────────────────────────────────────

interface JsonLdField {
  name: string;
  value: string;
  type: FieldType;
  schemaPath: string;
}

function extractJsonLdFields(fullHtml: string): JsonLdField[] {
  const $ = cheerio.load(fullHtml);
  const fields: JsonLdField[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '';
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = item['@type'];
        if (!type) continue;

        const mappings: Array<{ path: string; name: string; type: FieldType }> = [
          { path: 'name', name: 'title', type: 'string' },
          { path: 'headline', name: 'title', type: 'string' },
          { path: 'url', name: 'url', type: 'url' },
          { path: 'image', name: 'image', type: 'image' },
          { path: 'description', name: 'description', type: 'string' },
          { path: 'datePublished', name: 'date', type: 'date' },
          { path: 'dateCreated', name: 'date', type: 'date' },
          { path: 'offers.price', name: 'price', type: 'price' },
          { path: 'price', name: 'price', type: 'price' },
          { path: 'ratingValue', name: 'rating', type: 'number' },
          { path: 'aggregateRating.ratingValue', name: 'rating', type: 'number' },
          { path: 'addressLocality', name: 'location', type: 'string' },
        ];

        for (const { path, name, type: fieldType } of mappings) {
          const parts = path.split('.');
          let val: unknown = item;
          for (const part of parts) {
            if (val && typeof val === 'object') val = (val as Record<string, unknown>)[part];
            else { val = undefined; break; }
          }
          if (val && typeof val === 'string' && val.length > 0) {
            fields.push({ name, value: val, type: fieldType, schemaPath: `${type}.${path}` });
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  });

  return fields;
}

// Try to find the DOM selector for a known value within a block item
function correlateValueToSelector($: CheerioAPI, item: Element, value: string): string | null {
  const normalized = value.trim().toLowerCase();
  let found: string | null = null;

  $(item).find('*').each((_, el) => {
    if (el.type !== 'tag') return;
    const elEl = el as Element;
    const children = $(elEl).children();
    // Only check near-leaf nodes (few or no children)
    if (children.length > 2) return;
    const text = $(elEl).text().trim();
    if (text.toLowerCase() === normalized || text.toLowerCase().startsWith(normalized)) {
      found = buildRelativeSelector($, elEl, item);
      return false; // break
    }
    // Also check href/src attributes
    const href = $(elEl).attr('href');
    if (href && (href === value || href.endsWith(value))) {
      found = buildRelativeSelector($, elEl, item);
      return false;
    }
  });

  return found;
}

// ─── Priority 1: Open Graph extraction ───────────────────────────────────────

function extractOpenGraph(fullHtml: string): Record<string, string> {
  const $ = cheerio.load(fullHtml);
  const og: Record<string, string> = {};

  $('meta[property^="og:"], meta[name^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name') || '';
    const content = $(el).attr('content') || '';
    if (prop && content) {
      const key = prop.replace(/^og:|^twitter:/, '');
      og[key] = content;
    }
  });

  return og;
}

// ─── Priority 4: Structural position analysis ─────────────────────────────────

const ICON_LOGO_PATTERN = /icon|logo|avatar|badge|sprite|placeholder/i;
const PRICE_PATTERN = /[\$€£¥₹][\s\d,.]|[\d,]+\.?\d{0,2}\s*(?:USD|EUR|GBP|JPY)/;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;

function extractStructuralFields($: CheerioAPI, items: Element[]): SuggestedField[] {
  const fields: SuggestedField[] = [];
  const sampleSize = Math.min(items.length, DEFAULTS.sampleSize);
  const sample = items.slice(0, sampleSize);

  interface Candidate { selector: string; values: string[]; matchCount: number }
  const titleCandidates: Candidate[] = [];
  const imageCandidates: Candidate[] = [];
  const priceCandidates: Candidate[] = [];
  const dateCandidates: Candidate[] = [];
  const urlCandidates: Candidate[] = [];
  const numericCandidates: Candidate[] = [];

  for (const item of sample) {
    // Title: first text-only leaf node with 5–200 chars, not inside a nav/footer
    $(item).find('*').each((_, el) => {
      if (el.type !== 'tag') return;
      const elEl = el as Element;
      const tag = elEl.tagName.toLowerCase();
      if (['script', 'style', 'nav', 'footer', 'button', 'input'].includes(tag)) return;
      if ($(elEl).children('*').length > 0) return; // not a leaf-ish node
      const text = $(elEl).text().trim();
      if (text.length >= 5 && text.length <= 200) {
        const sel = buildRelativeSelector($, elEl, item);
        const existing = titleCandidates.find((c) => c.selector === sel);
        if (existing) { existing.matchCount++; existing.values.push(text); }
        else titleCandidates.push({ selector: sel, values: [text], matchCount: 1 });
        return false; // take first match per item
      }
    });

    // Image: first img not icon/logo-like
    $(item).find('img').each((_, el) => {
      const elEl = el as Element;
      const src = $(elEl).attr('src') || $(elEl).attr('data-src') || $(elEl).attr('data-lazy-src') || '';
      if (!src || ICON_LOGO_PATTERN.test(src)) return;
      const w = parseInt($(elEl).attr('width') || '0', 10);
      if (w > 0 && w <= 32) return; // tiny icon
      const sel = buildRelativeSelector($, elEl, item);
      const existing = imageCandidates.find((c) => c.selector === sel);
      if (existing) { existing.matchCount++; existing.values.push(src); }
      else imageCandidates.push({ selector: sel, values: [src], matchCount: 1 });
      return false;
    });

    // Price: text node matching currency pattern
    $(item).find('*').each((_, el) => {
      if (el.type !== 'tag') return;
      const elEl = el as Element;
      if ($(elEl).children('*').length > 0) return;
      const text = $(elEl).text().trim();
      if (PRICE_PATTERN.test(text)) {
        const sel = buildRelativeSelector($, elEl, item);
        const existing = priceCandidates.find((c) => c.selector === sel);
        if (existing) { existing.matchCount++; existing.values.push(text); }
        else priceCandidates.push({ selector: sel, values: [text], matchCount: 1 });
        return false;
      }
    });

    // Date: <time> or text matching date patterns
    const timeEl = $(item).find('time').first();
    if (timeEl.length) {
      const val = timeEl.attr('datetime') || timeEl.text().trim();
      const sel = buildRelativeSelector($, timeEl.get(0) as Element, item);
      const existing = dateCandidates.find((c) => c.selector === sel);
      if (existing) { existing.matchCount++; existing.values.push(val); }
      else dateCandidates.push({ selector: sel, values: [val], matchCount: 1 });
    } else {
      $(item).find('*').each((_, el) => {
        if (el.type !== 'tag') return;
        const elEl = el as Element;
        if ($(elEl).children('*').length > 0) return;
        const text = $(elEl).text().trim();
        if (DATE_PATTERN.test(text) && text.length < 40) {
          const sel = buildRelativeSelector($, elEl, item);
          const existing = dateCandidates.find((c) => c.selector === sel);
          if (existing) { existing.matchCount++; existing.values.push(text); }
          else dateCandidates.push({ selector: sel, values: [text], matchCount: 1 });
          return false;
        }
      });
    }

    // Numeric: leaf nodes with only digits (rank, score, count, elo, etc.)
    // Must NOT already match price or date patterns
    $(item).find('*').each((_, el) => {
      if (el.type !== 'tag') return;
      const elEl = el as Element;
      if ($(elEl).children('*').length > 0) return;
      const text = $(elEl).text().trim();
      // Pure numeric (integers and decimal numbers, 1-8 chars, e.g. "1", "42", "1750", "98.5")
      if (/^\d[\d,]*\.?\d{0,2}$/.test(text) && text.length <= 8 && !PRICE_PATTERN.test(text) && !DATE_PATTERN.test(text)) {
        const sel = buildRelativeSelector($, elEl, item);
        const existing = numericCandidates.find((c) => c.selector === sel);
        if (existing) { existing.matchCount++; existing.values.push(text); }
        else numericCandidates.push({ selector: sel, values: [text], matchCount: 1 });
        return false;
      }
    });

    // URL: first <a href> that is not just '#' or the same-page anchor
    $(item).find('a[href]').each((_, el) => {
      const elEl = el as Element;
      const href = $(elEl).attr('href') || '';
      if (!href || href === '#' || href.startsWith('#')) return;
      const sel = buildRelativeSelector($, elEl, item);
      const existing = urlCandidates.find((c) => c.selector === sel);
      if (existing) { existing.matchCount++; existing.values.push(href); }
      else urlCandidates.push({ selector: sel, values: [href], matchCount: 1 });
      return false;
    });
  }

  const threshold = Math.max(1, Math.floor(sampleSize * DEFAULTS.fieldMatchThreshold));

  const addBest = (
    candidates: Candidate[],
    name: string,
    type: FieldType,
    attribute?: string,
  ) => {
    const best = candidates.sort((a, b) => b.matchCount - a.matchCount)[0];
    if (best && best.matchCount >= threshold) {
      fields.push({
        name,
        selector: best.selector,
        fallbackSelectors: [],
        sampleValues: [...new Set(best.values)].slice(0, 5),
        inferredType: type,
        confidence: (best.matchCount / sampleSize) * 0.5 + 0.05, // structural = lower confidence
        inferenceSource: 'structural:position',
      });
    }
  };

  addBest(titleCandidates, 'title', 'string');
  addBest(imageCandidates, 'image', 'image', 'src');
  addBest(priceCandidates, 'price', 'price');
  addBest(dateCandidates, 'date', 'date');
  addBest(urlCandidates, 'url', 'url', 'href');
  addBest(numericCandidates, 'score', 'number');

  return fields;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function inferFields(
  html: string,
  block: RepeatedBlock,
  options?: { fullHtml?: string },
): SuggestedField[] {
  const fullHtml = options?.fullHtml ?? html;
  const $ = cheerio.load(html);

  // Split selector into parent + child parts to scope the query.
  // When the selector is generic (e.g. "div > div"), $(block.selector) matches
  // thousands of unrelated elements. Instead find the specific container whose
  // child count matches block.count, then use only its children.
  const sepIdx = block.selector.lastIndexOf(' > ');
  const parentSel = sepIdx >= 0 ? block.selector.substring(0, sepIdx) : block.parentSelector;
  const childSel = sepIdx >= 0 ? block.selector.substring(sepIdx + 3) : block.selector;

  let items: Element[] = [];
  const containers = $(parentSel).toArray().filter((el): el is Element => el.type === 'tag');
  if (containers.length > 0) {
    // Pick the container whose child count is closest to block.count
    const target = containers.reduce((best, el) => {
      const cc = $(el).children(childSel).length;
      const bc = best ? $(best).children(childSel).length : 0;
      return Math.abs(cc - block.count) < Math.abs(bc - block.count) ? el : best;
    }, null as Element | null);
    if (target) {
      items = $(target).children(childSel).toArray().filter((el): el is Element => el.type === 'tag');
    }
  }
  // Fallback: use full selector (original behaviour)
  if (items.length === 0) {
    items = $(block.selector).toArray().filter((el): el is Element => el.type === 'tag');
  }

  const sampleItems = items.slice(0, DEFAULTS.sampleSize);

  if (sampleItems.length === 0) {
    log.warn({ selector: block.selector }, 'No items found for field inference');
    return [];
  }

  const usedNames = new Set<string>();
  const allFields: SuggestedField[] = [];

  // ── Priority 0: JSON-LD ──────────────────────────────────────────────────
  const jsonLdFields = extractJsonLdFields(fullHtml);
  for (const jf of jsonLdFields) {
    if (usedNames.has(jf.name)) continue;

    // Try to correlate value to a DOM selector in sample items
    const selectorCounts = new Map<string, number>();
    let matchCount = 0;
    const sampleValues: string[] = [];

    for (const item of sampleItems) {
      const sel = correlateValueToSelector($, item, jf.value);
      if (sel) {
        selectorCounts.set(sel, (selectorCounts.get(sel) || 0) + 1);
        matchCount++;
        sampleValues.push(jf.value);
      }
    }

    const hitRate = matchCount / sampleItems.length;
    if (hitRate >= 0.4) { // lower threshold for JSON-LD since it's high quality
      const bestSel = [...selectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      if (bestSel) {
        allFields.push({
          name: jf.name,
          selector: bestSel,
          fallbackSelectors: [],
          sampleValues: [...new Set(sampleValues)].slice(0, 5),
          inferredType: jf.type,
          confidence: 0.95,
          inferenceSource: `jsonld:${jf.schemaPath}`,
        });
        usedNames.add(jf.name);
      }
    }
  }

  // ── Priority 1: Open Graph (page-level only — no per-item selector) ──────
  // OG is returned separately in SiteAnalysis.ogMetadata — no per-item fields here

  // ── Priority 2: CSS Rule-based (with microdata/itemprop) ─────────────────
  for (const rule of FIELD_RULES) {
    if (usedNames.has(rule.name)) continue;

    let matchCount = 0;
    const sampleValues: string[] = [];
    const selectorCounts = new Map<string, number>();

    for (const itemEl of sampleItems) {
      const $item = $(itemEl);
      let matched = false;

      for (const sel of rule.selectors) {
        const found = $item.find(sel).first();
        if (found.length === 0) continue;

        const foundEl = found.get(0) as Element;
        let value: string;
        if (rule.attribute === 'src') {
          value = found.attr('src') || found.attr('data-src') || found.attr('data-lazy-src') || found.attr('data-original') || '';
        } else if (rule.attribute) {
          value = found.attr(rule.attribute) || found.text().trim();
        } else {
          value = found.text().trim();
        }

        if (!value) continue;
        if (rule.contentTest && !rule.contentTest(value, foundEl, $)) continue;

        const relSel = buildRelativeSelector($, foundEl, itemEl);
        selectorCounts.set(relSel, (selectorCounts.get(relSel) || 0) + 1);
        sampleValues.push(value);
        matchCount++;
        matched = true;
        break;
      }
      void matched;
    }

    const hitRate = matchCount / sampleItems.length;
    if (hitRate < DEFAULTS.fieldMatchThreshold) continue;

    const bestSelector = [...selectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || rule.selectors[0];

    allFields.push({
      name: rule.name,
      selector: bestSelector,
      fallbackSelectors: generateFallbackSelectors(rule),
      sampleValues: [...new Set(sampleValues)].slice(0, 5),
      inferredType: rule.type,
      confidence: hitRate * 0.8 + (rule.priority <= 3 ? 0.2 : 0.1),
      inferenceSource: `rule:${rule.name}`,
    });

    usedNames.add(rule.name);
  }

  // ── Priority 3: Structural position (fallback for CSS-in-JS / Tailwind sites) ──
  const structuralFields = extractStructuralFields($, sampleItems);
  for (const sf of structuralFields) {
    if (!usedNames.has(sf.name)) {
      allFields.push(sf);
      usedNames.add(sf.name);
    }
  }

  // Also add Open Graph metadata as a reference (inferenceSource: 'og:*')
  const ogMeta = extractOpenGraph(fullHtml);
  const ogMap: Record<string, { name: string; type: FieldType }> = {
    title: { name: 'title', type: 'string' },
    description: { name: 'description', type: 'string' },
    image: { name: 'image', type: 'image' },
    url: { name: 'url', type: 'url' },
  };
  for (const [ogKey, fieldDef] of Object.entries(ogMap)) {
    if (ogMeta[ogKey] && !usedNames.has(fieldDef.name)) {
      // OG is page-level, try to correlate to items
      const selectorCounts = new Map<string, number>();
      let matchCount = 0;
      const sampleValues: string[] = [];
      for (const item of sampleItems) {
        const sel = correlateValueToSelector($, item, ogMeta[ogKey]);
        if (sel) {
          selectorCounts.set(sel, (selectorCounts.get(sel) || 0) + 1);
          matchCount++;
          sampleValues.push(ogMeta[ogKey]);
        }
      }
      const hitRate = matchCount / sampleItems.length;
      if (hitRate >= 0.4) {
        const bestSel = [...selectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (bestSel) {
          allFields.push({
            name: fieldDef.name,
            selector: bestSel,
            fallbackSelectors: [],
            sampleValues: [...new Set(sampleValues)].slice(0, 5),
            inferredType: fieldDef.type,
            confidence: 0.7,
            inferenceSource: `og:${ogKey}`,
          });
          usedNames.add(fieldDef.name);
        }
      }
    }
  }

  allFields.sort((a, b) => b.confidence - a.confidence);
  log.debug({ fieldCount: allFields.length, blockSelector: block.selector }, 'Fields inferred');
  return allFields;
}

export function extractPageOpenGraph(html: string): Record<string, string> {
  return extractOpenGraph(html);
}
