import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const MIGRATION_1 = `
CREATE TABLE employees (
 id TEXT PRIMARY KEY, full_name TEXT NOT NULL, position TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
);
CREATE TABLE time_entries (
 id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 description TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ux_one_active_timer_per_employee ON time_entries(employee_id) WHERE ended_at IS NULL;
CREATE INDEX idx_entries_employee_start ON time_entries(employee_id, started_at);
CREATE INDEX idx_entries_end ON time_entries(ended_at);
`;
export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version > 1) throw new Error('Версия базы данных новее поддерживаемой');
  if (version === 0)
    db.transaction(() => {
      db.exec(MIGRATION_1);
      db.pragma('user_version = 1');
    })();
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export const EMPLOYEE_COLUMNS =
  'id, full_name AS fullName, position, created_at AS createdAt, updated_at AS updatedAt, archived_at AS archivedAt';
export const ENTRY_COLUMNS =
  't.id, t.employee_id AS employeeId, t.description, t.started_at AS startedAt, t.ended_at AS endedAt, t.created_at AS createdAt, t.updated_at AS updatedAt';
