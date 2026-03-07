import type { FastifyInstance } from 'fastify';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import * as scheduleRepo from '../../persistence/repositories/schedule-repo.js';
import * as runRepo from '../../persistence/repositories/run-repo.js';

export function registerSourceRoutes(app: FastifyInstance): void {
  app.get('/sources', async (req) => {
    const query = req.query as Record<string, string>;
    const sources = sourceRepo.listSources(query.status);
    return { data: sources };
  });

  app.get('/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const source = sourceRepo.getSource(id);
    if (!source) return reply.status(404).send({ error: 'Source not found' });

    const config = configRepo.getActiveConfig(id);
    const schedule = scheduleRepo.getScheduleBySource(id);
    const latestRun = runRepo.getLatestRun(id);

    return { data: { source, config, schedule, latestRun } };
  });
}
