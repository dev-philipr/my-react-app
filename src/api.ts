import type {
  BudgetConfig,
  BudgetEntry,
  Transaction,
} from "./hooks/use-budgets";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ACCESS_DENIED = Symbol("ACCESS_DENIED");

function storedEmail(): string | null {
  try {
    return localStorage.getItem("dp_user_email");
  } catch {
    return null;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const email = storedEmail();
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(email ? { "X-User-Email": email } : {}),
      },
      ...init,
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── Spaces ───────────────────────────────────────────────────────────────────

export async function createSpace(
  name: string,
  slug: string,
): Promise<{ slug: string; name: string } | null> {
  return api("/api/spaces", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export type SpaceResponse = {
  slug: string;
  name: string;
  owner_email: string | null;
  is_private: boolean;
  members: string[];
  budgets: ServerBudget[];
};

export async function getSpace(
  projectSlug: string,
): Promise<SpaceResponse | typeof ACCESS_DENIED | null> {
  try {
    const email = storedEmail();
    const res = await fetch(`/api/spaces/${projectSlug}`, {
      headers: {
        "Content-Type": "application/json",
        ...(email ? { "X-User-Email": email } : {}),
      },
    });
    if (res.status === 403) return ACCESS_DENIED;
    if (!res.ok) return null;
    return res.json() as Promise<SpaceResponse>;
  } catch {
    return null;
  }
}

export async function updateSpace(
  projectSlug: string,
  patch: { slug?: string; name?: string },
): Promise<{ slug: string } | null> {
  return api(`/api/spaces/${projectSlug}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function updateSpaceSettings(
  projectSlug: string,
  patch: { is_private?: boolean },
): Promise<boolean> {
  const res = await api(`/api/spaces/${projectSlug}/settings`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res !== null;
}

export async function addSpaceMember(
  projectSlug: string,
  memberEmail: string,
): Promise<boolean> {
  const res = await api(`/api/spaces/${projectSlug}/members`, {
    method: "POST",
    body: JSON.stringify({ email: memberEmail }),
  });
  return res !== null;
}

export async function removeSpaceMember(
  projectSlug: string,
  memberEmail: string,
): Promise<boolean> {
  const res = await api(
    `/api/spaces/${projectSlug}/members/${encodeURIComponent(memberEmail)}`,
    { method: "DELETE" },
  );
  return res !== null;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export interface ServerBudget {
  id: number;
  slug: string;
  project_slug: string;
  name: string;
  range_from: string;
  range_to: string;
  budget: number;
  starting_budget?: number;
  daily_budget: number;
  color: string;
  created_at: string;
  transactions: ServerTransaction[];
}

export async function createBudget(
  projectSlug: string,
  slug: string,
  name: string,
  config: BudgetConfig,
  color: string,
): Promise<{ slug: string } | null> {
  return api(`/api/spaces/${projectSlug}/budgets`, {
    method: "POST",
    body: JSON.stringify({
      slug,
      name,
      rangeFrom: config.rangeFrom,
      rangeTo: config.rangeTo,
      budget: config.budget,
      startingBudget: config.startingBudget,
      dailyBudget: config.dailyBudget,
      color,
    }),
  });
}

export async function updateBudget(
  projectSlug: string,
  budgetSlug: string,
  patch: { name?: string; color?: string } | BudgetConfig,
): Promise<boolean> {
  const body =
    "rangeFrom" in patch
      ? {
          rangeFrom: patch.rangeFrom,
          rangeTo: patch.rangeTo,
          budget: patch.budget,
          startingBudget: patch.startingBudget,
          dailyBudget: patch.dailyBudget,
        }
      : patch;
  const res = await api(`/api/spaces/${projectSlug}/budgets/${budgetSlug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res !== null;
}

export async function deleteBudget(
  projectSlug: string,
  budgetSlug: string,
): Promise<boolean> {
  const res = await api(`/api/spaces/${projectSlug}/budgets/${budgetSlug}`, {
    method: "DELETE",
  });
  return res !== null;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface ServerTransaction {
  id: string;
  budget_id: number;
  date: string;
  name?: string;
  credit: number;
  debit: number;
}

export async function upsertTransaction(
  projectSlug: string,
  budgetSlug: string,
  tx: Omit<Transaction, "id"> & { id?: string },
): Promise<{ id: string } | null> {
  if (tx.id) {
    const res = await api(
      `/api/spaces/${projectSlug}/budgets/${budgetSlug}/transactions/${tx.id}`,
      { method: "PUT", body: JSON.stringify(tx) },
    );
    return res !== null ? { id: tx.id } : null;
  }
  return api(`/api/spaces/${projectSlug}/budgets/${budgetSlug}/transactions`, {
    method: "POST",
    body: JSON.stringify(tx),
  });
}

export async function deleteTransaction(
  projectSlug: string,
  budgetSlug: string,
  txId: string,
): Promise<boolean> {
  const res = await api(
    `/api/spaces/${projectSlug}/budgets/${budgetSlug}/transactions/${txId}`,
    { method: "DELETE" },
  );
  return res !== null;
}

// ─── Server → local type conversion ──────────────────────────────────────────

export function serverBudgetToEntry(b: ServerBudget): BudgetEntry {
  return {
    meta: {
      id: b.slug,
      name: b.name,
      color: b.color,
      createdAt: b.created_at,
    },
    config: {
      rangeFrom: b.range_from,
      rangeTo: b.range_to,
      budget: b.budget,
      startingBudget: b.starting_budget ?? b.daily_budget,
      dailyBudget: b.daily_budget,
    },
    transactions: (b.transactions ?? []).map((t) => ({
      id: t.id,
      date: t.date,
      name: t.name,
      credit: t.credit,
      debit: t.debit,
    })),
  };
}
