import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "./components/ui/provider";
import BudgetDetail from "./budget-details";
import BudgetList from "./budget-list";
import { useBudgets } from "./hooks/use-budgets";

function AppRoutes() {
  const {
    index,
    createBudget,
    deleteBudget,
    getBudgetEntry,
    updateBudgetConfig,
    upsertTransaction,
    deleteTransaction,
    PALETTE,
  } = useBudgets();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <BudgetList
            index={index}
            getBudgetEntry={getBudgetEntry}
            createBudget={createBudget}
            deleteBudget={deleteBudget}
            PALETTE={PALETTE}
          />
        }
      />
      <Route
        path="/budget/:id"
        element={
          <BudgetDetail
            getBudgetEntry={getBudgetEntry}
            updateBudgetConfig={updateBudgetConfig}
            upsertTransaction={upsertTransaction}
            deleteTransaction={deleteTransaction}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider defaultTheme="light">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}
