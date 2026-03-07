import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('robots');

interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

function parseRobotsTxt(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();

    if (key.toLowerCase() === 'user-agent') {
      current = { userAgent: value.toLowerCase(), disallow: [], allow: [] };
      rules.push(current);
    } else if (current) {
      if (key.toLowerCase() === 'disallow' && value) {
        current.disallow.push(value);
      } else if (key.toLowerCase() === 'allow' && value) {
        current.allow.push(value);
      }
    }
  }

  return rules;
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern === '/') return true;
  if (pattern.endsWith('*')) {
    return path.startsWith(pattern.slice(0, -1));
  }
  return path.startsWith(pattern);
}

export async function checkRobotsTxt(
  url: string,
  userAgent = 'websource',
): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': userAgent },
    });

    if (!response.ok) return true; // no robots.txt = allowed

    const text = await response.text();
    const rules = parseRobotsTxt(text);
    const pathname = parsed.pathname;

    // Check specific user agent first, then wildcard
    for (const ua of [userAgent.toLowerCase(), '*']) {
      const matching = rules.filter((r) => r.userAgent === ua);
      for (const rule of matching) {
        // Allow takes precedence over disallow for same specificity
        for (const allow of rule.allow) {
          if (pathMatches(allow, pathname)) return true;
        }
        for (const disallow of rule.disallow) {
          if (pathMatches(disallow, pathname)) return false;
        }
      }
    }

    return true;
  } catch (error) {
    log.warn({ error, url }, 'Failed to fetch robots.txt, assuming allowed');
    return true;
  }
}
