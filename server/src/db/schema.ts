/**
 * SQLite schema of a user's diary database. Migrations are applied by
 * `applySchema` which is idempotent and versioned (`schema_version` table).
 *
 * A database written by a NEWER version of the app (schema_version > SCHEMA_VERSION - e.g. a
 * backup made on an updated phone, restored on a computer that was not updated yet) is refused
 * with `NewerSchemaError`: this version does not know its tables, and writing to it could damage
 * it. The callers turn that into a localised message ('server.vault.newerVersion' when a diary
 * is opened, 'server.backup.newerVersion' when a backup is restored).
 *
 * Arrays (emotions, events, people, tags) are stored as JSON text columns -
 * simple to read/write and queryable with SQLite's json_each().
 */
import type { DiaryDb } from './database';

export const SCHEMA_VERSION = 1;

/** The database was written by a newer version of the app: `found` > `supported` (SCHEMA_VERSION). */
export class NewerSchemaError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number = SCHEMA_VERSION,
  ) {
    super(`database schema version ${found} is newer than the supported version ${supported}`);
    this.name = 'NewerSchemaError';
  }
}

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      date             TEXT    NOT NULL,                 -- YYYY-MM-DD
      time             TEXT    NOT NULL,                 -- HH:MM
      title            TEXT    NOT NULL DEFAULT '',
      body             TEXT    NOT NULL DEFAULT '',
      mood             INTEGER,                          -- 1..10
      emotions_json    TEXT    NOT NULL DEFAULT '[]',
      energy           INTEGER,                          -- 1..10
      stress           INTEGER,                          -- 1..10
      sleep_quality    INTEGER,                          -- 1..10
      sleep_hours      REAL,                             -- 0..24
      exercise_minutes INTEGER,                          -- NULL = not reported
      exercise_type    TEXT    NOT NULL DEFAULT '',
      events_json      TEXT    NOT NULL DEFAULT '[]',
      people_json      TEXT    NOT NULL DEFAULT '[]',
      location         TEXT    NOT NULL DEFAULT '',
      notes            TEXT    NOT NULL DEFAULT '',
      tags_json        TEXT    NOT NULL DEFAULT '[]',
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date, time);

    CREATE TABLE IF NOT EXISTS habits (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      description      TEXT    NOT NULL DEFAULT '',
      target           REAL    NOT NULL DEFAULT 1,
      unit             TEXT    NOT NULL DEFAULT '',
      frequency        TEXT    NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
      reminder_time    TEXT,                             -- HH:MM
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      is_archived      INTEGER NOT NULL DEFAULT 0,
      sort_order       INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date      TEXT    NOT NULL,
      value     REAL    NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      note      TEXT    NOT NULL DEFAULT '',
      UNIQUE(habit_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Free-text metadata kept inside the encrypted DB (e.g. owner name for exports).
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `,
};

export function currentVersion(db: DiaryDb): number {
  const hasTable = db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='schema_version'",
  );
  if (!hasTable || Number(hasTable.n) === 0) return 0;
  const row = db.get<{ version: number }>('SELECT MAX(version) AS version FROM schema_version');
  return row && row.version != null ? Number(row.version) : 0;
}

/**
 * Applies all pending migrations. Safe to call on every open. Throws `NewerSchemaError` - before
 * anything is written - for a database of a newer schema version.
 */
export function applySchema(db: DiaryDb): void {
  const from = currentVersion(db);
  if (from > SCHEMA_VERSION) throw new NewerSchemaError(from);
  if (from === SCHEMA_VERSION) return;
  db.transaction(() => {
    for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
      const sql = MIGRATIONS[v];
      if (!sql) throw new Error(`missing migration ${v}`);
      db.exec(sql);
      db.run('INSERT INTO schema_version(version) VALUES (?)', [v]);
    }
  });
}
