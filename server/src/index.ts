import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// API routes
app.get("/api/", (c) => {
  return c.json({ name: "Cloudflare" });
});

app.get("/api/expenses", async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM expenses ORDER BY date DESC",
    ).all();
    return c.json({ expenses: result.results });
  } catch (error) {
    return c.json({ error: "Failed to fetch expenses" }, 500);
  }
});

app.post("/api/expenses", async (c) => {
  try {
    const { amount, description, category, date } = await c.req.json();

    if (!amount || !description || !date) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await c.env.DB.prepare(
      "INSERT INTO expenses (amount, description, category, date) VALUES (?, ?, ?, ?)",
    )
      .bind(amount, description, category || null, date)
      .run();

    return c.json(
      {
        success: true,
        id: result.meta.last_row_id,
      },
      201,
    );
  } catch (error) {
    return c.json({ error: "Failed to create expense" }, 500);
  }
});

app.get("/api/expenses/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("SELECT * FROM expenses WHERE id = ?")
      .bind(id)
      .first();

    if (!result) {
      return c.json({ error: "Expense not found" }, 404);
    }

    return c.json(result);
  } catch (error) {
    return c.json({ error: "Failed to fetch expense" }, 500);
  }
});

app.put("/api/expenses/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { amount, description, category, date } = await c.req.json();

    if (!amount || !description || !date) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await c.env.DB.prepare(
      "UPDATE expenses SET amount = ?, description = ?, category = ?, date = ? WHERE id = ?",
    )
      .bind(amount, description, category || null, date, id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: "Expense not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update expense" }, 500);
  }
});

app.delete("/api/expenses/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await c.env.DB.prepare("DELETE FROM expenses WHERE id = ?")
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: "Expense not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete expense" }, 500);
  }
});

export default app;
