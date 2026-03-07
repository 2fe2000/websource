import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  });
}
