import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetMeta {
  id: string;
  name: string;
  createdAt: string; // ISO
  color: string; // e.g. "green", "blue", "green"
}

export interface BudgetConfig {
  rangeFrom: string;
  rangeTo: string;
  budget: number;
  dailyBudget: number;
}

export interface Transaction {
  id: string;
  credit: number;
  debit: number;
  date: string;
  name?: string;
}

export interface BudgetEntry {
  meta: BudgetMeta;
  config: BudgetConfig;
  transactions: Transaction[];
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  INDEX: "budgets_index_v1",
  ENTRY: (id: string) => `budget_entry_${id}_v1`,
  // Legacy keys from the original single-budget app
  LEGACY_CONFIG: "budget_config_v1",
  LEGACY_TRANSACTIONS: "budget_transactions_v1",
} as const;


function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Migration: single budget → multi ────────────────────────────────────────

function migrateLegacy(): BudgetEntry | null {
  try {
    const rawConfig = localStorage.getItem(KEYS.LEGACY_CONFIG);
    if (!rawConfig) return null;
    const config = JSON.parse(rawConfig) as BudgetConfig;
    const rawTxs = localStorage.getItem(KEYS.LEGACY_TRANSACTIONS);
    const transactions: Transaction[] = rawTxs ? JSON.parse(rawTxs) : [];

    const entry: BudgetEntry = {
      meta: {
        id: "legacy",
        name: "My Budget",
        createdAt: new Date().toISOString(),
        color: "green",
      },
      config,
      transactions,
    };
    return entry;
  } catch {
    return null;
  }
}

// ─── Load / Save helpers ──────────────────────────────────────────────────────

function loadIndex(): BudgetMeta[] {
  try {
    const raw = localStorage.getItem(KEYS.INDEX);
    if (raw) return JSON.parse(raw) as BudgetMeta[];

    // First run — check for legacy data
    const legacy = migrateLegacy();
    if (legacy) {
      const index = [legacy.meta];
      localStorage.setItem(KEYS.INDEX, JSON.stringify(index));
      localStorage.setItem(KEYS.ENTRY(legacy.meta.id), JSON.stringify(legacy));
      return index;
    }

    return [];
  } catch {
    return [];
  }
}

function loadEntry(id: string): BudgetEntry | null {
  try {
    const raw = localStorage.getItem(KEYS.ENTRY(id));
    return raw ? (JSON.parse(raw) as BudgetEntry) : null;
  } catch {
    return null;
  }
}

function saveIndex(index: BudgetMeta[]): void {
  localStorage.setItem(KEYS.INDEX, JSON.stringify(index));
}

function saveEntry(entry: BudgetEntry): void {
  localStorage.setItem(KEYS.ENTRY(entry.meta.id), JSON.stringify(entry));
}

function deleteEntry(id: string): void {
  localStorage.removeItem(KEYS.ENTRY(id));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBudgets() {
  const [index, setIndex] = useState<BudgetMeta[]>(loadIndex);

  // Persist index on change
  useEffect(() => {
    saveIndex(index);
  }, [index]);

  const createBudget = useCallback(
    (name: string, config: BudgetConfig): string => {
      const id = genId();
      const meta: BudgetMeta = {
        id,
        name,
        createdAt: new Date().toISOString(),
        color: "green",
      };
      const entry: BudgetEntry = { meta, config, transactions: [] };
      saveEntry(entry);
      setIndex((prev) => [...prev, meta]);
      return id;
    },
    [],
  );

  const deleteBudget = useCallback((id: string) => {
    deleteEntry(id);
    setIndex((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateBudgetMeta = useCallback(
    (id: string, patch: Partial<Pick<BudgetMeta, "name" | "color">>) => {
      setIndex((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      const entry = loadEntry(id);
      if (entry) {
        saveEntry({ ...entry, meta: { ...entry.meta, ...patch } });
      }
    },
    [],
  );

  const getBudgetEntry = useCallback((id: string): BudgetEntry | null => {
    return loadEntry(id);
  }, []);

  const updateBudgetConfig = useCallback((id: string, config: BudgetConfig) => {
    const entry = loadEntry(id);
    if (!entry) return;
    const updated = { ...entry, config };
    saveEntry(updated);
  }, []);

  const upsertTransaction = useCallback(
    (budgetId: string, tx: Omit<Transaction, "id"> & { id?: string }) => {
      const entry = loadEntry(budgetId);
      if (!entry) return;
      const newTx: Transaction = { ...tx, id: tx.id ?? genId() };
      const updated = {
        ...entry,
        transactions: tx.id
          ? entry.transactions.map((t) => (t.id === tx.id ? newTx : t))
          : [...entry.transactions, newTx],
      };
      saveEntry(updated);
    },
    [],
  );

  const deleteTransaction = useCallback((budgetId: string, txId: string) => {
    const entry = loadEntry(budgetId);
    if (!entry) return;
    saveEntry({
      ...entry,
      transactions: entry.transactions.filter((t) => t.id !== txId),
    });
  }, []);

  return {
    index,
    createBudget,
    deleteBudget,
    updateBudgetMeta,
    getBudgetEntry,
    updateBudgetConfig,
    upsertTransaction,
    deleteTransaction,
  };
}
