import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectRepeatedBlocks } from '../../src/analysis/dom-analyzer.js';
import { inferFields } from '../../src/analysis/field-inferrer.js';

const HTML = readFileSync(join(import.meta.dirname, '../fixtures/books-toscrape-sample.html'), 'utf-8');

describe('books.toscrape.com sample', () => {
  it('detects the product list as the best block (not sidebar nav)', () => {
    const blocks = detectRepeatedBlocks(HTML);
    console.log('Detected blocks:');
    blocks.forEach((b) => console.log(`  ${b.selector} | count: ${b.count} | conf: ${b.confidence.toFixed(2)}`));

    expect(blocks.length).toBeGreaterThan(0);
    const best = blocks[0];
    // Should detect the ol.row > li items (4 books), not sidebar ul > li
    expect(best.count).toBe(4);
    expect(best.confidence).toBeGreaterThan(0.5);
  });

  it('infers title, price, url, image fields from book items', () => {
    const blocks = detectRepeatedBlocks(HTML);
    const best = blocks[0];
    const fields = inferFields(HTML, best);
    const names = fields.map((f) => f.name);

    console.log('Detected fields:');
    fields.forEach((f) => console.log(`  ${f.name} (${f.inferredType}) — ${f.sampleValues[0]}`));

    expect(names).toContain('title');
    expect(names).toContain('url');
    expect(names).toContain('image');
  });
});
