import type { FastifyInstance } from 'fastify';
import * as snapshotRepo from '../../persistence/repositories/snapshot-repo.js';

export function registerDataRoutes(app: FastifyInstance): void {
  app.get('/sources/:id/data', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string>;

    let snapshot;
    if (query.run) {
      snapshot = snapshotRepo.getSnapshotByRun(query.run);
    } else {
      snapshot = snapshotRepo.getLatestSnapshot(id);
    }

    if (!snapshot) return reply.status(404).send({ error: 'No data available' });

    const limit = parseInt(query.limit || '100', 10);
    const offset = parseInt(query.offset || '0', 10);
    const records = snapshot.records.slice(offset, offset + limit);

    return {
      data: records,
      meta: {
        snapshotId: snapshot.id,
        recordCount: snapshot.recordCount,
        total: snapshot.records.length,
        limit,
        offset,
        extractedAt: snapshot.createdAt,
      },
    };
  });
}
