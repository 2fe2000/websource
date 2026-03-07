import { z } from 'zod';

export const globalConfigSchema = z.object({
  dataDir: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  defaultFetchMode: z.enum(['static', 'rendered']).default('static'),
  defaultRateLimit: z.number().int().positive().default(1000),
  defaultTimeout: z.number().int().positive().default(30000),
  defaultUserAgent: z.string().optional(),
  server: z
    .object({
      port: z.number().int().positive().default(3847),
      host: z.string().default('127.0.0.1'),
    })
    .default({}),
  maxResponseBytes: z.number().int().positive().optional(),
  rateLimiterTtlMs: z.number().int().positive().optional(),
});

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
