import { describe, it, expect } from 'vitest';
import { inferFields } from '../../src/analysis/field-inferrer.js';
import { detectRepeatedBlocks } from '../../src/analysis/dom-analyzer.js';

const HTML = `
<html><body>
  <div class="products">
    <div class="product-card">
      <h3><a href="/product/1">Widget Alpha</a></h3>
      <span class="price">$19.99</span>
      <img src="/img/alpha.jpg" />
      <p class="desc">A wonderful widget for your home.</p>
    </div>
    <div class="product-card">
      <h3><a href="/product/2">Widget Beta</a></h3>
      <span class="price">$29.99</span>
      <img src="/img/beta.jpg" />
      <p class="desc">The best beta widget on the market.</p>
    </div>
    <div class="product-card">
      <h3><a href="/product/3">Widget Gamma</a></h3>
      <span class="price">$39.99</span>
      <img src="/img/gamma.jpg" />
      <p class="desc">Gamma-level quality in a compact form.</p>
    </div>
    <div class="product-card">
      <h3><a href="/product/4">Widget Delta</a></h3>
      <span class="price">$49.99</span>
      <img src="/img/delta.jpg" />
      <p class="desc">Delta delivers dependable performance daily.</p>
    </div>
  </div>
</body></html>`;

describe('inferFields', () => {
  it('detects title, url, image, and price fields', () => {
    const blocks = detectRepeatedBlocks(HTML);
    expect(blocks.length).toBeGreaterThan(0);

    const fields = inferFields(HTML, blocks[0]);
    const fieldNames = fields.map((f) => f.name);

    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('url');
    expect(fieldNames).toContain('image');
    expect(fieldNames).toContain('price');
  });

  it('provides sample values for detected fields', () => {
    const blocks = detectRepeatedBlocks(HTML);
    const fields = inferFields(HTML, blocks[0]);

    const titleField = fields.find((f) => f.name === 'title');
    expect(titleField).toBeDefined();
    expect(titleField!.sampleValues.length).toBeGreaterThan(0);
    expect(titleField!.sampleValues[0]).toContain('Widget');
  });

  it('assigns correct types', () => {
    const blocks = detectRepeatedBlocks(HTML);
    const fields = inferFields(HTML, blocks[0]);

    const urlField = fields.find((f) => f.name === 'url');
    expect(urlField?.inferredType).toBe('url');

    const priceField = fields.find((f) => f.name === 'price');
    expect(priceField?.inferredType).toBe('price');

    const imageField = fields.find((f) => f.name === 'image');
    expect(imageField?.inferredType).toBe('image');
  });
});
