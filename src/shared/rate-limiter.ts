import { DEFAULTS } from '../config/defaults.js';

const domainTimestamps = new Map<string, number>();

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function rateLimitedWait(url: string, minIntervalMs: number): Promise<void> {
  const domain = getDomain(url);
  const lastRequest = domainTimestamps.get(domain);

  if (lastRequest) {
    const elapsed = Date.now() - lastRequest;
    if (elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }
  }

  // Prune stale entries to prevent unbounded memory growth in long-running processes
  const now = Date.now();
  for (const [d, ts] of domainTimestamps) {
    if (now - ts > DEFAULTS.rateLimiterTtlMs) domainTimestamps.delete(d);
  }

  domainTimestamps.set(domain, now);
}

export function resetRateLimiter(): void {
  domainTimestamps.clear();
}
