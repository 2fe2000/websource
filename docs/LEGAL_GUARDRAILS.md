# Legal Guardrails

## robots.txt

websource respects `robots.txt` by default:

- Before analyzing or extracting, the tool fetches `/robots.txt` from the target domain
- If the path is disallowed for the user agent, the tool reports it and refuses to extract
- This behavior can be overridden per-source via `robotsPolicy: 'ignore'` in the config, but users should understand the implications

## Polite Crawling

- **Rate limiting**: Default 1000ms between requests to the same domain. Configurable per source.
- **User agent**: Identifies as `websource/0.1.0` by default. Transparent, not deceptive.
- **Retries**: Exponential backoff with jitter. Won't hammer a failing server.

## What websource Does NOT Do

- **No authentication bypass**: The tool does not log in, handle CAPTCHAs, or bypass access controls
- **No anti-bot circumvention**: No fingerprint spoofing, no headless detection evasion, no proxy rotation
- **No credential storage**: No support for storing or using login credentials
- **No aggressive crawling**: Respects rate limits and does not parallelize requests to the same domain

## User Responsibilities

Users of websource are responsible for:

1. **Terms of Service**: Checking that their extraction complies with the website's ToS
2. **Copyright**: Respecting copyright on extracted content
3. **Data protection**: Complying with GDPR, CCPA, and other privacy regulations when extracting personal data
4. **Rate limits**: Setting appropriate rate limits to avoid overloading target servers
5. **robots.txt**: Understanding what the robots.txt policy means before overriding it

## Configuration

Per-source controls:

| Setting | Default | Description |
|---|---|---|
| `robotsPolicy` | `respect` | Whether to obey robots.txt |
| `rateLimitMs` | `1000` | Minimum ms between requests |
| `maxRetries` | `3` | Max retry attempts |
| `timeoutMs` | `30000` | Request timeout |
| `userAgent` | `websource/0.1.0` | User-Agent header |
