import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import cloudflareLogo from "./assets/cloudflare.svg";
import heroImg from "./assets/hero.png";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("unknown");
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    // Fetch expenses on component mount
    fetch("/api/expenses")
      .then((res) => res.json())
      .then((data) => setExpenses(data.expenses || []))
      .catch((error) => console.error("Failed to fetch expenses:", error));
  }, []);

  const addExpense = async () => {
    const newExpense = {
      amount: Math.floor(Math.random() * 100) + 10,
      description: "Sample expense",
      category: "Food",
      date: new Date().toISOString().split("T")[0],
    };

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newExpense),
    });

    if (response.ok) {
      // Refresh the expenses list
      fetch("/api/expenses")
        .then((res) => res.json())
        .then((data) => setExpenses(data.expenses || []));
    }
  };

  const deleteExpense = async (id: number) => {
    const response = await fetch(`/api/expenses/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      // Refresh the expenses list
      fetch("/api/expenses")
        .then((res) => res.json())
        .then((data) => setExpenses(data.expenses || []));
    }
  };

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started with Cloudflare NOPE</h1>
          <p>
            Edit <code>src/App.tsx</code> or <code>worker/index.ts</code> and
            save to test <code>HMR</code>
          </p>
        </div>
        <ul
          style={{
            display: "flex",
            gap: "1rem",
            listStyle: "none",
            padding: 0,
          }}
        >
          <li>
            <button
              className="counter"
              onClick={() => setCount((count) => count + 1)}
            >
              Count is {count}
            </button>
          </li>
          <li>
            <button
              className="counter"
              onClick={() => {
                fetch("/api/")
                  .then((res) => res.json())
                  .then((data) => setName(data.name));
              }}
              aria-label="get name"
            >
              Name from API is: {name}
            </button>
          </li>
          <li>
            <button
              className="counter"
              onClick={() => {
                fetch("/api/expenses")
                  .then((res) => res.json())
                  .then((data) => setExpenses(data.expenses || []));
              }}
              aria-label="get expenses"
            >
              Fetch Expenses ({expenses.length})
            </button>
          </li>
          <li>
            <button
              className="counter"
              onClick={addExpense}
              aria-label="add expense"
            >
              Add Sample Expense
            </button>
          </li>
        </ul>
        {expenses.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Expenses:</h3>
            <ul>
              {expenses.map((expense: any) => (
                <li key={expense.id} style={{ marginBottom: "0.5rem" }}>
                  ${expense.amount} - {expense.description} ({expense.category})
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    style={{ marginLeft: "1rem" }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
            <li>
              <a href="https://workers.cloudflare.com/" target="_blank">
                <img className="button-icon" src={cloudflareLogo} alt="" />
                Workers Docs
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  );
}

export default App;
