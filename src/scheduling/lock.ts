import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getLocksDir } from '../config/paths.js';

function getLockPath(sourceId: string): string {
  return join(getLocksDir(), `${sourceId}.lock`);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(sourceId: string): boolean {
  const lockPath = getLockPath(sourceId);

  if (existsSync(lockPath)) {
    const content = readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(content, 10);

    if (!isNaN(pid) && isProcessRunning(pid)) {
      return false; // Lock held by running process
    }

    // Stale lock — remove it
    unlinkSync(lockPath);
  }

  writeFileSync(lockPath, String(process.pid));
  return true;
}

export function releaseLock(sourceId: string): void {
  const lockPath = getLockPath(sourceId);
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
  }
}
