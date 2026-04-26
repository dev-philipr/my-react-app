import { Hono } from "hono";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────


function shortId(): string {
  return nanoid(8);
}

async function getBudgetId(
  db: D1Database,
  projectSlug: string,
  budgetSlug: string,
): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM budgets WHERE project_slug = ? AND slug = ?")
    .bind(projectSlug, budgetSlug)
    .first<{ id: number }>();
  return row?.id ?? null;
}

// ─── Legacy routes (kept for backwards compat) ────────────────────────────────

app.get("/api/", (c) => c.json({ name: "Day Pocket API" }));

app.get("/api/expenses", async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM expenses ORDER BY date DESC",
    ).all();
    return c.json({ expenses: result.results });
  } catch {
    return c.json({ expenses: [] });
  }
});

// ─── Project Spaces ───────────────────────────────────────────────────────────

app.post("/api/spaces", async (c) => {
  const body = await c.req.json<{ name?: string; slug?: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name required" }, 400);

  const slug = body.slug?.trim() || shortId();

  try {
    await c.env.DB.prepare(
      "INSERT INTO project_spaces (slug, name) VALUES (?, ?)",
    )
      .bind(slug, name)
      .run();
    return c.json({ slug, name }, 201);
  } catch {
    // Slug already exists — return it
    const existing = await c.env.DB.prepare(
      "SELECT slug, name FROM project_spaces WHERE slug = ?",
    )
      .bind(slug)
      .first<{ slug: string; name: string }>();
    return c.json(existing ?? { slug, name }, 200);
  }
});

app.put("/api/spaces/:projectSlug", async (c) => {
  const { projectSlug } = c.req.param();
  const body = await c.req.json<{ slug?: string; name?: string }>();
  const newSlug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (!newSlug && !body.name) return c.json({ error: "slug or name required" }, 400);

  if (newSlug && newSlug !== projectSlug) {
    const conflict = await c.env.DB.prepare(
      "SELECT slug FROM project_spaces WHERE slug = ?",
    )
      .bind(newSlug)
      .first();
    if (conflict) return c.json({ error: "Slug already taken" }, 409);

    await c.env.DB.prepare(
      "UPDATE project_spaces SET slug = ?, name = COALESCE(?, name) WHERE slug = ?",
    )
      .bind(newSlug, body.name ?? null, projectSlug)
      .run();

    return c.json({ slug: newSlug });
  }

  if (body.name) {
    await c.env.DB.prepare(
      "UPDATE project_spaces SET name = ? WHERE slug = ?",
    )
      .bind(body.name, projectSlug)
      .run();
  }

  return c.json({ slug: projectSlug });
});

app.get("/api/spaces/:projectSlug", async (c) => {
  const { projectSlug } = c.req.param();

  const space = await c.env.DB.prepare(
    "SELECT * FROM project_spaces WHERE slug = ?",
  )
    .bind(projectSlug)
    .first();
  if (!space) return c.json({ error: "Space not found" }, 404);

  const budgetsResult = await c.env.DB.prepare(
    "SELECT * FROM budgets WHERE project_slug = ? ORDER BY created_at DESC",
  )
    .bind(projectSlug)
    .all();

  // Fetch all transactions for this space via budget_id join
  const txResult = await c.env.DB.prepare(
    `SELECT t.*, b.slug AS budget_slug
     FROM transactions t
     JOIN budgets b ON t.budget_id = b.id
     WHERE b.project_slug = ?
     ORDER BY t.date DESC`,
  )
    .bind(projectSlug)
    .all();

  // Group transactions by budget slug
  const txByBudget = new Map<string, unknown[]>();
  for (const tx of txResult.results) {
    const slug = (tx as { budget_slug: string }).budget_slug;
    if (!txByBudget.has(slug)) txByBudget.set(slug, []);
    txByBudget.get(slug)!.push(tx);
  }

  const budgets = budgetsResult.results.map((b) => ({
    ...b,
    transactions: txByBudget.get((b as { slug: string }).slug) ?? [],
  }));

  return c.json({ ...space, budgets });
});

// ─── Budgets ──────────────────────────────────────────────────────────────────

app.post("/api/spaces/:projectSlug/budgets", async (c) => {
  const { projectSlug } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    slug?: string;
    rangeFrom?: string;
    rangeTo?: string;
    budget?: number;
    dailyBudget?: number;
    color?: string;
  }>();

  const name = body.name?.trim();
  if (!name || !body.rangeFrom || !body.rangeTo)
    return c.json({ error: "name, rangeFrom, rangeTo required" }, 400);

  const slug = body.slug?.trim() || shortId();

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO budgets (slug, project_slug, name, range_from, range_to, budget, daily_budget, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        slug,
        projectSlug,
        name,
        body.rangeFrom,
        body.rangeTo,
        body.budget ?? 0,
        body.dailyBudget ?? 0,
        body.color ?? "green",
      )
      .run();
    return c.json(
      { id: result.meta.last_row_id, slug, projectSlug, name },
      201,
    );
  } catch {
    return c.json({ error: "Budget slug already taken in this space" }, 409);
  }
});

app.get("/api/spaces/:projectSlug/budgets/:budgetSlug", async (c) => {
  const { projectSlug, budgetSlug } = c.req.param();

  const budget = await c.env.DB.prepare(
    "SELECT * FROM budgets WHERE project_slug = ? AND slug = ?",
  )
    .bind(projectSlug, budgetSlug)
    .first<{ id: number }>();
  if (!budget) return c.json({ error: "Budget not found" }, 404);

  const transactions = await c.env.DB.prepare(
    "SELECT * FROM transactions WHERE budget_id = ? ORDER BY date DESC",
  )
    .bind(budget.id)
    .all();

  return c.json({ ...budget, transactions: transactions.results });
});

app.put("/api/spaces/:projectSlug/budgets/:budgetSlug", async (c) => {
  const { projectSlug, budgetSlug } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    rangeFrom?: string;
    rangeTo?: string;
    budget?: number;
    dailyBudget?: number;
    color?: string;
  }>();

  const result = await c.env.DB.prepare(
    `UPDATE budgets SET
      name         = COALESCE(?, name),
      range_from   = COALESCE(?, range_from),
      range_to     = COALESCE(?, range_to),
      budget       = COALESCE(?, budget),
      daily_budget = COALESCE(?, daily_budget),
      color        = COALESCE(?, color)
    WHERE project_slug = ? AND slug = ?`,
  )
    .bind(
      body.name ?? null,
      body.rangeFrom ?? null,
      body.rangeTo ?? null,
      body.budget ?? null,
      body.dailyBudget ?? null,
      body.color ?? null,
      projectSlug,
      budgetSlug,
    )
    .run();

  if (result.meta.changes === 0)
    return c.json({ error: "Budget not found" }, 404);
  return c.json({ success: true });
});

app.delete("/api/spaces/:projectSlug/budgets/:budgetSlug", async (c) => {
  const { projectSlug, budgetSlug } = c.req.param();

  const result = await c.env.DB.prepare(
    "DELETE FROM budgets WHERE project_slug = ? AND slug = ?",
  )
    .bind(projectSlug, budgetSlug)
    .run();

  if (result.meta.changes === 0)
    return c.json({ error: "Budget not found" }, 404);
  return c.json({ success: true });
});

// ─── Transactions ─────────────────────────────────────────────────────────────

app.post(
  "/api/spaces/:projectSlug/budgets/:budgetSlug/transactions",
  async (c) => {
    const { projectSlug, budgetSlug } = c.req.param();
    const body = await c.req.json<{
      id?: string;
      date?: string;
      name?: string;
      credit?: number;
      debit?: number;
    }>();

    if (!body.date) return c.json({ error: "date required" }, 400);

    const budgetId = await getBudgetId(c.env.DB, projectSlug, budgetSlug);
    if (budgetId === null) return c.json({ error: "Budget not found" }, 404);

    const id = body.id || nanoid();

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO transactions (id, budget_id, date, name, credit, debit)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        budgetId,
        body.date,
        body.name ?? null,
        body.credit ?? 0,
        body.debit ?? 0,
      )
      .run();

    return c.json({ id }, 201);
  },
);

app.put(
  "/api/spaces/:projectSlug/budgets/:budgetSlug/transactions/:txId",
  async (c) => {
    const { projectSlug, budgetSlug, txId } = c.req.param();
    const body = await c.req.json<{
      date?: string;
      name?: string;
      credit?: number;
      debit?: number;
    }>();

    const budgetId = await getBudgetId(c.env.DB, projectSlug, budgetSlug);
    if (budgetId === null) return c.json({ error: "Budget not found" }, 404);

    const result = await c.env.DB.prepare(
      `UPDATE transactions SET date = ?, name = ?, credit = ?, debit = ?
       WHERE id = ? AND budget_id = ?`,
    )
      .bind(
        body.date,
        body.name ?? null,
        body.credit ?? 0,
        body.debit ?? 0,
        txId,
        budgetId,
      )
      .run();

    if (result.meta.changes === 0)
      return c.json({ error: "Transaction not found" }, 404);
    return c.json({ success: true });
  },
);

app.delete(
  "/api/spaces/:projectSlug/budgets/:budgetSlug/transactions/:txId",
  async (c) => {
    const { projectSlug, budgetSlug, txId } = c.req.param();

    const budgetId = await getBudgetId(c.env.DB, projectSlug, budgetSlug);
    if (budgetId === null) return c.json({ error: "Budget not found" }, 404);

    const result = await c.env.DB.prepare(
      "DELETE FROM transactions WHERE id = ? AND budget_id = ?",
    )
      .bind(txId, budgetId)
      .run();

    if (result.meta.changes === 0)
      return c.json({ error: "Transaction not found" }, 404);
    return c.json({ success: true });
  },
);

// ─── Migration (localStorage → DB) ───────────────────────────────────────────

app.post("/api/migrate", async (c) => {
  const body = await c.req.json<{
    spaceSlug: string;
    spaceName?: string;
    budgets?: Array<{
      slug: string;
      name: string;
      color?: string;
      config: {
        rangeFrom: string;
        rangeTo: string;
        budget: number;
        dailyBudget: number;
      };
      transactions?: Array<{
        id: string;
        date: string;
        name?: string;
        credit: number;
        debit: number;
      }>;
    }>;
  }>();

  if (!body.spaceSlug) return c.json({ error: "spaceSlug required" }, 400);

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO project_spaces (slug, name) VALUES (?, ?)",
  )
    .bind(body.spaceSlug, body.spaceName ?? "My Space")
    .run();

  for (const b of body.budgets ?? []) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO budgets
         (slug, project_slug, name, range_from, range_to, budget, daily_budget, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        b.slug,
        body.spaceSlug,
        b.name,
        b.config.rangeFrom,
        b.config.rangeTo,
        b.config.budget,
        b.config.dailyBudget,
        b.color ?? "green",
      )
      .run();

    const budgetId = await getBudgetId(c.env.DB, body.spaceSlug, b.slug);
    if (budgetId === null) continue;

    for (const tx of b.transactions ?? []) {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO transactions (id, budget_id, date, name, credit, debit)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(tx.id, budgetId, tx.date, tx.name ?? null, tx.credit, tx.debit)
        .run();
    }
  }

  return c.json({ success: true });
});

export default app;
