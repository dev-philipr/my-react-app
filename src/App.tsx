import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "./components/ui/provider";

const queryClient = new QueryClient();
import BudgetDetail from "./budget-details";
import BudgetList from "./budget-list";
import { useBudgets } from "./hooks/use-budgets";
import { usePersonalSpace } from "./hooks/use-space";

// ─── Route components ─────────────────────────────────────────────────────────

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

// Redirect legacy /budget/:id URLs to /:spaceSlug/:id
function LegacyRedirect({ spaceSlug }: { spaceSlug: string }) {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/${spaceSlug}/${id}`} replace />;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { spaceSlug, ready } = usePersonalSpace();

  if (!ready) return null;

  return (
    <Routes>
      <Route
        path="/"
        element={
          spaceSlug ? <Navigate to={`/${spaceSlug}`} replace /> : null
        }
      />
      <Route
        path="/budget/:id"
        element={
          spaceSlug ? <LegacyRedirect spaceSlug={spaceSlug} /> : <Navigate to="/" replace />
        }
      />
      <Route path="/:projectSlug" element={<BudgetListRoute />} />
      <Route path="/:projectSlug/:budgetSlug" element={<BudgetDetailRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider defaultTheme="light">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  );
}
