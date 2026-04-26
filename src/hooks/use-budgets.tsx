import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customAlphabet } from "nanoid";
import {
  createSpace,
  createBudget as apiBudget,
  updateBudget as apiUpdateBudget,
  updateSpace as apiUpdateSpace,
  updateSpaceSettings as apiUpdateSettings,
  addSpaceMember as apiAddMember,
  removeSpaceMember as apiRemoveMember,
  deleteBudget as apiDeleteBudget,
  upsertTransaction as apiUpsertTx,
  deleteTransaction as apiDeleteTx,
  getSpace,
  serverBudgetToEntry,
  ACCESS_DENIED,
  type ServerBudget,
  type ServerTransaction,
} from "../api";
import { getStoredEmail } from "./use-email";

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
  owner_email: string | null;
  is_private: boolean;
  members: string[];
  budgets: ServerBudget[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spaceKey(projectSlug: string) {
  return ["space", projectSlug] as const;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBudgets(projectSlug: string) {
  const queryClient = useQueryClient();

  const { data: space, isLoading, error } = useQuery<SpaceData | null>({
    queryKey: spaceKey(projectSlug),
    queryFn: async () => {
      let result = await getSpace(projectSlug);
      if (result === ACCESS_DENIED) throw Object.assign(new Error("ACCESS_DENIED"), { code: 403 });
      if (!result) {
        await createSpace(projectSlug, projectSlug);
        result = await getSpace(projectSlug);
        if (result === ACCESS_DENIED) throw Object.assign(new Error("ACCESS_DENIED"), { code: 403 });
      }
      return result as SpaceData | null;
    },
    retry: (_, err) => (err as { code?: number }).code !== 403,
    staleTime: 30_000,
  });

  const accessDenied = (error as { code?: number } | null)?.code === 403;

  const storedEmail = getStoredEmail();
  const spaceIsPrivate = space?.is_private ?? false;
  const spaceOwnerEmail = space?.owner_email ?? null;
  const spaceMembers = space?.members ?? [];
  const isOwner =
    !spaceIsPrivate ||
    spaceOwnerEmail === null ||
    (storedEmail !== null && spaceOwnerEmail === storedEmail);

  const index = useMemo(
    () => (space?.budgets ?? []).map((b) => serverBudgetToEntry(b).meta),
    [space],
  );

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

  // ── Space ──────────────────────────────────────────────────────────────────

  const renameSpace = useCallback(
    async (newSlug: string): Promise<string | null> => {
      const result = await apiUpdateSpace(projectSlug, { slug: newSlug });
      return result?.slug ?? null;
    },
    [projectSlug],
  );

  const claimSpace = useCallback(
    async (): Promise<boolean> => {
      const ok = await apiUpdateSettings(projectSlug, {});
      if (ok) invalidate();
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug],
  );

  const updateSpacePrivacy = useCallback(
    async (isPrivate: boolean): Promise<boolean> => {
      const ok = await apiUpdateSettings(projectSlug, { is_private: isPrivate });
      if (ok) invalidate();
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug],
  );

  const addMember = useCallback(
    async (memberEmail: string): Promise<boolean> => {
      const ok = await apiAddMember(projectSlug, memberEmail.trim().toLowerCase());
      if (ok) {
        patch((prev) => ({
          ...prev,
          members: [...prev.members, memberEmail.trim().toLowerCase()].sort(),
        }));
      }
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug],
  );

  const removeMember = useCallback(
    async (memberEmail: string): Promise<boolean> => {
      const ok = await apiRemoveMember(projectSlug, memberEmail);
      if (ok) {
        patch((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m !== memberEmail),
        }));
      }
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug],
  );

  // ── Budgets ────────────────────────────────────────────────────────────────

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

  // ── Transactions ───────────────────────────────────────────────────────────

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
    accessDenied,
    spaceIsPrivate,
    spaceOwnerEmail,
    spaceMembers,
    isOwner,
    createBudget,
    deleteBudget,
    updateBudgetMeta,
    getBudgetEntry,
    updateBudgetConfig,
    upsertTransaction,
    deleteTransaction,
    renameSpace,
    claimSpace,
    updateSpacePrivacy,
    addMember,
    removeMember,
  };
}
