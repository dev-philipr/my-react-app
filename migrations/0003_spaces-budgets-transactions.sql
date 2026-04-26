-- Migration number: 0003 	 2026-04-26T04:40:29.000Z

CREATE TABLE IF NOT EXISTS project_spaces (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,
  project_slug TEXT NOT NULL REFERENCES project_spaces(slug) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  range_from   TEXT NOT NULL,
  range_to     TEXT NOT NULL,
  budget       REAL NOT NULL DEFAULT 0,
  daily_budget REAL NOT NULL DEFAULT 0,
  color        TEXT NOT NULL DEFAULT 'green',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_slug, slug)
);

CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT NOT NULL,
  budget_id  INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  name       TEXT,
  credit     REAL NOT NULL DEFAULT 0,
  debit      REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, budget_id)
);
