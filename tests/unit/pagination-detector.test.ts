import { describe, it, expect } from 'vitest';
import { detectPagination } from '../../src/analysis/pagination-detector.js';

describe('detectPagination', () => {
  it('detects rel=next links', () => {
    const html = `
      <html><body>
        <a rel="next" href="/page/2">Next</a>
      </body></html>`;

    const hints = detectPagination(html, 'https://example.com/page/1');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].strategy).toBe('next-link');
    expect(hints[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects pagination containers with page params', () => {
    const html = `
      <html><body>
        <nav aria-label="pagination">
          <a href="/items?page=1">1</a>
          <a href="/items?page=2">2</a>
          <a href="/items?page=3">3</a>
        </nav>
      </body></html>`;

    const hints = detectPagination(html, 'https://example.com/items?page=1');
    expect(hints.length).toBeGreaterThan(0);
  });

  it('returns empty for pages without pagination', () => {
    const html = '<html><body><p>No pagination here</p></body></html>';
    const hints = detectPagination(html, 'https://example.com/about');
    expect(hints.length).toBe(0);
  });

  it('detects text-based next links', () => {
    const html = `
      <html><body>
        <div class="pager">
          <a href="/page/2">Next</a>
        </div>
      </body></html>`;

    const hints = detectPagination(html, 'https://example.com/page/1');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].strategy).toBe('next-link');
  });
});
