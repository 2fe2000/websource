export const DEFAULTS = {
  fetchMode: 'static' as const,
  rateLimitMs: 1000,
  timeoutMs: 30000,
  maxRetries: 3,
  robotsPolicy: 'respect' as const,
  userAgent: 'websource/0.1.0 (https://github.com/2fe2000/websource)',
  maxPages: 10,
  serverPort: 3847,
  serverHost: '127.0.0.1',
  logLevel: 'info',
  confidenceThreshold: 0.3,
  minRepeatedBlocks: 3,
  sampleSize: 5,
  fieldMatchThreshold: 0.6,

  // Rendering decision (fetcher.ts)
  renderingScoreThreshold: 0.4,
  minBodyTextLength: 300,

  // Playwright browser (rendered-fetcher.ts)
  viewportWidth: 1280,
  viewportHeight: 900,
  maxStabilizationMs: 8000,
  frameworkWaitMs: 5000,

  // DOM block analysis (dom-analyzer.ts)
  maxRepeatedBlocks: 10,
  blockConfidenceThreshold: 0.2,

  // Extraction health (validator.ts)
  requiredFieldCoverageThreshold: 0.8,
  errorRateThreshold: 0.3,
  degradedConfidenceMultiplier: 0.7,

  // Security
  maxResponseBytes: 10 * 1024 * 1024, // 10 MB

  // Rate limiter memory management
  rateLimiterTtlMs: 60 * 60 * 1000, // 1 hour
} as const;
