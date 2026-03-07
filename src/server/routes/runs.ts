import type { FastifyInstance } from 'fastify';
import * as runRepo from '../../persistence/repositories/run-repo.js';
import * as sourceRepo from '../../persistence/repositories/source-repo.js';
import * as configRepo from '../../persistence/repositories/config-repo.js';
import { runExtraction } from '../../extraction/pipeline.js';

export function registerRunRoutes(app: FastifyInstance): void {
  app.get('/sources/:id/runs', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string>;
    const limit = parseInt(query.limit || '20', 10);
    const runs = runRepo.listRuns(id, limit);
    return { data: runs };
  });

  app.get('/sources/:id/runs/:runId', async (req, reply) => {
    const { runId } = req.params as { id: string; runId: string };
    const run = runRepo.getRun(runId);
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    return { data: run };
  });

  app.post('/sources/:id/extract', async (req, reply) => {
    const { id } = req.params as { id: string };
    const source = sourceRepo.getSource(id);
    if (!source) return reply.status(404).send({ error: 'Source not found' });

    const config = configRepo.getActiveConfig(id);
    if (!config) return reply.status(404).send({ error: 'No active config' });

    // Fire and forget — extraction runs async
    const run = runRepo.createRun({ sourceId: id, configId: config.id, trigger: 'api' });

    runExtraction(source, config, { trigger: 'api' }).catch(() => {});

    return reply.status(202).send({ data: { runId: run.id, status: 'pending' } });
  });
}
