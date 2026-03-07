import Fastify from 'fastify';
import { DEFAULTS } from '../config/defaults.js';
import { registerSourceRoutes } from './routes/sources.js';
import { registerDataRoutes } from './routes/data.js';
import { registerRunRoutes } from './routes/runs.js';
import { registerDiffRoutes } from './routes/diffs.js';
import { registerHealthRoute } from './routes/health.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('server');

export async function startServer(options?: { port?: number; host?: string }): Promise<void> {
  const port = options?.port ?? DEFAULTS.serverPort;
  const host = options?.host ?? DEFAULTS.serverHost;

  const app = Fastify({ logger: false });

  registerHealthRoute(app);
  registerSourceRoutes(app);
  registerDataRoutes(app);
  registerRunRoutes(app);
  registerDiffRoutes(app);

  await app.listen({ port, host });
  log.info({ port, host }, 'Server started');
  console.log(`Server listening on http://${host}:${port}`);
}
