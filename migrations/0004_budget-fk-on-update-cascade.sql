-- Migration number: 0004    2026-04-26
-- Recreate budgets with ON UPDATE CASCADE so renaming a space slug
-- automatically cascades to budgets.project_slug.

PRAGMA foreign_keys = OFF;

CREATE TABLE budgets_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,
  project_slug TEXT NOT NULL REFERENCES project_spaces(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  name         TEXT NOT NULL,
  range_from   TEXT NOT NULL,
  range_to     TEXT NOT NULL,
  budget       REAL NOT NULL DEFAULT 0,
  daily_budget REAL NOT NULL DEFAULT 0,
  color        TEXT NOT NULL DEFAULT 'green',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_slug, slug)
);

INSERT INTO budgets_new SELECT * FROM budgets;

DROP TABLE budgets;

ALTER TABLE budgets_new RENAME TO budgets;

PRAGMA foreign_keys = ON;
