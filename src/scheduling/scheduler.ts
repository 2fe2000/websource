import cron from 'node-cron';
import * as scheduleRepo from '../persistence/repositories/schedule-repo.js';
import { executeScheduledRun } from './runner.js';
import { createChildLogger } from '../shared/logger.js';

const log = createChildLogger('scheduler');

export class Scheduler {
  private tasks = new Map<string, cron.ScheduledTask>();

  async start(): Promise<void> {
    const schedules = scheduleRepo.listEnabledSchedules();
    log.info({ count: schedules.length }, 'Loading schedules');

    for (const schedule of schedules) {
      this.register(schedule.sourceId, schedule.cronExpr);
    }
  }

  register(sourceId: string, cronExpr: string): void {
    if (!cron.validate(cronExpr)) {
      log.error({ sourceId, cronExpr }, 'Invalid cron expression');
      return;
    }

    // Remove existing task if any
    this.unregister(sourceId);

    const task = cron.schedule(cronExpr, () => {
      log.info({ sourceId }, 'Cron triggered');
      executeScheduledRun(sourceId).catch((err) => {
        log.error({ sourceId, error: err.message }, 'Scheduled run failed');
      });
    });

    this.tasks.set(sourceId, task);
    log.info({ sourceId, cronExpr }, 'Schedule registered');
  }

  unregister(sourceId: string): void {
    const existing = this.tasks.get(sourceId);
    if (existing) {
      existing.stop();
      this.tasks.delete(sourceId);
    }
  }

  async reload(): Promise<void> {
    this.shutdown();
    await this.start();
  }

  shutdown(): void {
    for (const [sourceId, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    log.info('Scheduler shut down');
  }

  getActiveCount(): number {
    return this.tasks.size;
  }
}
