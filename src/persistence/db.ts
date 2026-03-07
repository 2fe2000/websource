import Database from 'better-sqlite3';
import { getDbPath } from '../config/paths.js';
import { runMigrations } from './migrations/001-initial.js';

let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();
  _db = new Database(dbPath);

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  runMigrations(_db);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}
