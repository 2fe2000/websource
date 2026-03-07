import pino from 'pino';
import { getDataDir } from '../config/paths.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let _logger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (_logger) return _logger;

  const dataDir = getDataDir();
  const logDir = join(dataDir, 'logs');
  mkdirSync(logDir, { recursive: true });

  const level = process.env.LOG_LEVEL || 'warn';

  if (process.env.NODE_ENV === 'production') {
    // Production: file-based logging at info level
    _logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: { target: 'pino/file', options: { destination: join(logDir, 'websource.log') } },
    });
  } else if (level === 'debug' || level === 'trace') {
    // Explicit debug: use pino-pretty (async, but user asked for it)
    _logger = pino({
      level,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  } else {
    // Default CLI: warn level, write to stderr synchronously so it doesn't interleave
    _logger = pino({ level }, process.stderr);
  }

  return _logger;
}

export function createChildLogger(name: string): pino.Logger {
  return getLogger().child({ module: name });
}
