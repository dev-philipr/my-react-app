import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "./components/ui/provider";
import { customAlphabet } from "nanoid";
import { createSpace } from "./api";

const queryClient = new QueryClient();
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

import BudgetDetail from "./budget-details";
import BudgetList from "./budget-list";
import { useBudgets } from "./hooks/use-budgets";

// ─── Route components ─────────────────────────────────────────────────────────

function HomeRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const slug = nanoid(8);
    createSpace(slug, slug).then(() => navigate(`/${slug}`, { replace: true }));
  }, [navigate]);

  return null;
}

function BudgetListRoute() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const budgets = useBudgets(projectSlug!);
  return <BudgetList projectSlug={projectSlug!} {...budgets} />;
}

function BudgetDetailRoute() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const budgets = useBudgets(projectSlug!);
  return <BudgetDetail {...budgets} />;
}

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider defaultTheme="light">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/:projectSlug" element={<BudgetListRoute />} />
            <Route path="/:projectSlug/:budgetSlug" element={<BudgetDetailRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  );
}
