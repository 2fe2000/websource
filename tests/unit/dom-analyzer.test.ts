import { describe, it, expect } from 'vitest';
import { detectRepeatedBlocks, classifyPage } from '../../src/analysis/dom-analyzer.js';

const PRODUCT_LIST_HTML = `
<html><body>
  <div class="products">
    <div class="product-card">
      <h3><a href="/product/1">Widget A</a></h3>
      <span class="price">$19.99</span>
      <img src="/img/a.jpg" />
    </div>
    <div class="product-card">
      <h3><a href="/product/2">Widget B</a></h3>
      <span class="price">$29.99</span>
      <img src="/img/b.jpg" />
    </div>
    <div class="product-card">
      <h3><a href="/product/3">Widget C</a></h3>
      <span class="price">$39.99</span>
      <img src="/img/c.jpg" />
    </div>
    <div class="product-card">
      <h3><a href="/product/4">Widget D</a></h3>
      <span class="price">$49.99</span>
      <img src="/img/d.jpg" />
    </div>
    <div class="product-card">
      <h3><a href="/product/5">Widget E</a></h3>
      <span class="price">$59.99</span>
      <img src="/img/e.jpg" />
    </div>
  </div>
  <nav class="pagination">
    <a href="/products?page=1">1</a>
    <a href="/products?page=2">2</a>
    <a rel="next" href="/products?page=2">Next</a>
  </nav>
</body></html>`;

describe('detectRepeatedBlocks', () => {
  it('detects product cards as a repeated block', () => {
    const blocks = detectRepeatedBlocks(PRODUCT_LIST_HTML);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].count).toBe(5);
    expect(blocks[0].confidence).toBeGreaterThan(0.3);
  });

  it('returns empty for non-list pages', () => {
    const html = '<html><body><h1>About Us</h1><p>We are a company.</p></body></html>';
    const blocks = detectRepeatedBlocks(html);
    expect(blocks.length).toBe(0);
  });
});

describe('classifyPage', () => {
  it('classifies a product list page', () => {
    const result = classifyPage(PRODUCT_LIST_HTML, 'https://example.com/products');
    expect(result.type).toBe('list');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('classifies a detail page URL pattern', () => {
    const html = '<html><body><article><h1>Product</h1><p>Description</p></article></body></html>';
    const result = classifyPage(html, 'https://example.com/product/widget-a');
    // Should detect as detail or article based on signals
    expect(['detail', 'article']).toContain(result.type);
  });
});
