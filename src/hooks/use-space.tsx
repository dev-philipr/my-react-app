import { useState, useEffect } from "react";
import { createSpace, migrateToServer } from "../api";
import type { BudgetConfig, BudgetEntry, Transaction } from "./use-budgets";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SPACE_SLUG_KEY = "dp_space_slug";
const MIGRATED_KEY = "dp_migrated_v2";

// Legacy keys from the previous localStorage-only version
const LEGACY_INDEX_KEY = "budgets_index_v1";
const LEGACY_ENTRY_KEY = (id: string) => `budget_entry_${id}_v1`;
const LEGACY_CONFIG_KEY = "budget_config_v1";
const LEGACY_TXS_KEY = "budget_transactions_v1";

// ─── Legacy data readers ──────────────────────────────────────────────────────

interface LegacyMeta {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

function readLegacyBudgets(): Array<{
  slug: string;
  name: string;
  color: string;
  config: BudgetConfig;
  transactions: Transaction[];
}> {
  try {
    // Very old single-budget format
    const rawConfig = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (rawConfig) {
      const config = JSON.parse(rawConfig) as BudgetConfig;
      const rawTxs = localStorage.getItem(LEGACY_TXS_KEY);
      const transactions: Transaction[] = rawTxs ? JSON.parse(rawTxs) : [];
      return [
        {
          slug: "my-budget",
          name: "My Budget",
          color: "green",
          config,
          transactions,
        },
      ];
    }

    // Multi-budget format
    const rawIndex = localStorage.getItem(LEGACY_INDEX_KEY);
    if (!rawIndex) return [];

    const index = JSON.parse(rawIndex) as LegacyMeta[];
    return index
      .map((meta) => {
        try {
          const raw = localStorage.getItem(LEGACY_ENTRY_KEY(meta.id));
          if (!raw) return null;
          const entry = JSON.parse(raw) as BudgetEntry;
          return {
            slug: meta.id,
            name: meta.name,
            color: meta.color ?? "green",
            config: entry.config,
            transactions: entry.transactions,
          };
        } catch {
          return null;
        }
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  } catch {
    return [];
  }
}

function clearLegacyData() {
  try {
    const rawIndex = localStorage.getItem(LEGACY_INDEX_KEY);
    if (rawIndex) {
      const index = JSON.parse(rawIndex) as LegacyMeta[];
      for (const { id } of index) {
        localStorage.removeItem(LEGACY_ENTRY_KEY(id));
      }
    }
    localStorage.removeItem(LEGACY_INDEX_KEY);
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    localStorage.removeItem(LEGACY_TXS_KEY);
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePersonalSpace(): {
  spaceSlug: string | null;
  ready: boolean;
} {
  const [spaceSlug, setSpaceSlug] = useState<string | null>(() =>
    localStorage.getItem(SPACE_SLUG_KEY),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      let slug = localStorage.getItem(SPACE_SLUG_KEY);

      if (!slug) {
        slug = nanoid(8);
        await createSpace("My Space", slug);
        localStorage.setItem(SPACE_SLUG_KEY, slug);
        setSpaceSlug(slug);
      }

      // One-time migration of old localStorage data to the server
      if (!localStorage.getItem(MIGRATED_KEY)) {
        const legacyBudgets = readLegacyBudgets();
        if (legacyBudgets.length > 0) {
          const ok = await migrateToServer(slug, "My Space", legacyBudgets);
          if (ok) clearLegacyData();
        }
        localStorage.setItem(MIGRATED_KEY, "true");
      }

      setReady(true);
    }

    init();
  }, []);

  return { spaceSlug, ready };
}
