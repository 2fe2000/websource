import type { FastifyInstance } from 'fastify';
import * as diffRepo from '../../persistence/repositories/diff-repo.js';

export function registerDiffRoutes(app: FastifyInstance): void {
  app.get('/sources/:id/diffs', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string>;
    const limit = parseInt(query.limit || '20', 10);
    const diffs = diffRepo.listDiffs(id, limit);
    return { data: diffs };
  });

  app.get('/sources/:id/diffs/:diffId', async (req, reply) => {
    const { diffId } = req.params as { id: string; diffId: string };
    const diff = diffRepo.getDiff(diffId);
    if (!diff) return reply.status(404).send({ error: 'Diff not found' });
    return { data: diff };
  });
}
