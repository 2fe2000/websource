import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

function resolveXDGData(): string {
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
}

function resolveXDGConfig(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

export function getDataDir(): string {
  const dir = process.env.WEBSOURCE_DATA_DIR || join(resolveXDGData(), 'websource');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getConfigDir(): string {
  const dir = process.env.WEBSOURCE_CONFIG_DIR || join(resolveXDGConfig(), 'websource');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath(): string {
  return join(getDataDir(), 'websource.db');
}

export function getLocksDir(): string {
  const dir = join(getDataDir(), 'locks');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getLogsDir(): string {
  const dir = join(getDataDir(), 'logs');
  mkdirSync(dir, { recursive: true });
  return dir;
}
