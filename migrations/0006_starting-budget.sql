-- Migration number: 0006    2026-05-02
-- Add configurable day-1 starting balance per budget.

ALTER TABLE budgets ADD COLUMN starting_budget REAL NOT NULL DEFAULT 0;

-- Preserve previous behavior by initializing starting budget from total budget.
UPDATE budgets
SET starting_budget = budget;
