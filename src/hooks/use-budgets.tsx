import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customAlphabet } from "nanoid";
import {
  createSpace,
  createBudget as apiBudget,
  updateBudget as apiUpdateBudget,
  deleteBudget as apiDeleteBudget,
  upsertTransaction as apiUpsertTx,
  deleteTransaction as apiDeleteTx,
  getSpace,
  serverBudgetToEntry,
  type ServerBudget,
  type ServerTransaction,
} from "../api";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetMeta {
  id: string;
  name: string;
  createdAt: string;
  color: string;
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

type SpaceData = {
  slug: string;
  name: string;
  budgets: ServerBudget[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spaceKey(projectSlug: string) {
  return ["space", projectSlug] as const;
}

// ─── localStorage helpers (used for initialData only) ─────────────────────────

const indexKey = (p: string) => `dp_index_${p}`;
const entryKey = (p: string, s: string) => `dp_entry_${p}_${s}`;

function loadIndex(projectSlug: string): BudgetMeta[] {
  try {
    const raw = localStorage.getItem(indexKey(projectSlug));
    return raw ? (JSON.parse(raw) as BudgetMeta[]) : [];
  } catch {
    return [];
  }
}

function loadEntry(projectSlug: string, slug: string): BudgetEntry | null {
  try {
    const raw = localStorage.getItem(entryKey(projectSlug, slug));
    return raw ? (JSON.parse(raw) as BudgetEntry) : null;
  } catch {
    return null;
  }
}

function persistSpace(projectSlug: string, space: SpaceData) {
  const entries = space.budgets.map(serverBudgetToEntry);
  try {
    localStorage.setItem(
      indexKey(projectSlug),
      JSON.stringify(entries.map((e) => e.meta)),
    );
    entries.forEach((e) =>
      localStorage.setItem(entryKey(projectSlug, e.meta.id), JSON.stringify(e)),
    );
  } catch {}
}

function localInitialData(projectSlug: string): SpaceData | undefined {
  const idx = loadIndex(projectSlug);
  if (!idx.length) return undefined;
  const budgets: ServerBudget[] = idx.flatMap((meta) => {
    const entry = loadEntry(projectSlug, meta.id);
    if (!entry) return [];
    return [
      {
        id: 0,
        slug: meta.id,
        project_slug: projectSlug,
        name: meta.name,
        range_from: entry.config.rangeFrom,
        range_to: entry.config.rangeTo,
        budget: entry.config.budget,
        daily_budget: entry.config.dailyBudget,
        color: meta.color,
        created_at: meta.createdAt,
        transactions: entry.transactions.map((tx) => ({
          id: tx.id,
          budget_id: 0,
          date: tx.date,
          name: tx.name,
          credit: tx.credit,
          debit: tx.debit,
        })),
      },
    ];
  });
  return { slug: projectSlug, name: "My Space", budgets };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBudgets(projectSlug: string) {
  const queryClient = useQueryClient();

  const { data: space, isLoading } = useQuery<SpaceData | null>({
    queryKey: spaceKey(projectSlug),
    queryFn: async () => {
      let result = await getSpace(projectSlug);
      if (!result) {
        await createSpace(projectSlug, projectSlug);
        result = await getSpace(projectSlug);
      }
      if (result) persistSpace(projectSlug, result);
      return result;
    },
    initialData: () => localInitialData(projectSlug),
    initialDataUpdatedAt: 0, // treat localStorage data as immediately stale → always refetches
    staleTime: 30_000,
  });

  const index = useMemo(
    () => (space?.budgets ?? []).map((b) => serverBudgetToEntry(b).meta),
    [space],
  );

  // Reads from the query cache — re-evaluates whenever space updates
  const getBudgetEntry = useCallback(
    (id: string): BudgetEntry | null => {
      const b = space?.budgets.find((b) => b.slug === id) ?? null;
      return b ? serverBudgetToEntry(b) : null;
    },
    [space],
  );

  function patch(updater: (prev: SpaceData) => SpaceData) {
    queryClient.setQueryData<SpaceData | null>(spaceKey(projectSlug), (prev) =>
      prev ? updater(prev) : prev,
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: spaceKey(projectSlug) });
  }

  const createBudget = useCallback(
    (name: string, config: BudgetConfig): string => {
      const slug = nanoid(8);
      patch((prev) => ({
        ...prev,
        budgets: [
          ...prev.budgets,
          {
            id: 0,
            slug,
            project_slug: projectSlug,
            name,
            range_from: config.rangeFrom,
            range_to: config.rangeTo,
            budget: config.budget,
            daily_budget: config.dailyBudget,
            color: "green",
            created_at: new Date().toISOString(),
            transactions: [],
          },
        ],
      }));
      apiBudget(projectSlug, slug, name, config, "green").then(invalidate);
      return slug;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  const deleteBudget = useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        budgets: prev.budgets.filter((b) => b.slug !== id),
      }));
      apiDeleteBudget(projectSlug, id).then(invalidate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  const updateBudgetMeta = useCallback(
    (id: string, p: Partial<Pick<BudgetMeta, "name" | "color">>) => {
      patch((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) =>
          b.slug !== id
            ? b
            : { ...b, name: p.name ?? b.name, color: p.color ?? b.color },
        ),
      }));
      apiUpdateBudget(projectSlug, id, p).then(invalidate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  const updateBudgetConfig = useCallback(
    (id: string, config: BudgetConfig) => {
      patch((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) =>
          b.slug !== id
            ? b
            : {
                ...b,
                range_from: config.rangeFrom,
                range_to: config.rangeTo,
                budget: config.budget,
                daily_budget: config.dailyBudget,
              },
        ),
      }));
      apiUpdateBudget(projectSlug, id, config).then(invalidate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  const upsertTransaction = useCallback(
    (budgetId: string, tx: Omit<Transaction, "id"> & { id?: string }) => {
      const newTx: ServerTransaction = {
        id: tx.id ?? nanoid(),
        budget_id: 0,
        date: tx.date,
        name: tx.name,
        credit: tx.credit,
        debit: tx.debit,
      };
      patch((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) => {
          if (b.slug !== budgetId) return b;
          const txs = tx.id
            ? b.transactions.map((t) =>
                t.id === tx.id ? { ...newTx, budget_id: t.budget_id } : t,
              )
            : [...b.transactions, { ...newTx, budget_id: b.id }];
          return { ...b, transactions: txs };
        }),
      }));
      apiUpsertTx(projectSlug, budgetId, tx).then(invalidate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  const deleteTransaction = useCallback(
    (budgetId: string, txId: string) => {
      patch((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) =>
          b.slug !== budgetId
            ? b
            : {
                ...b,
                transactions: b.transactions.filter((t) => t.id !== txId),
              },
        ),
      }));
      apiDeleteTx(projectSlug, budgetId, txId).then(invalidate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, queryClient],
  );

  return {
    index,
    syncing: isLoading,
    createBudget,
    deleteBudget,
    updateBudgetMeta,
    getBudgetEntry,
    updateBudgetConfig,
    upsertTransaction,
    deleteTransaction,
  };
}
