import { UTCDate } from "@date-fns/utc";
import { eachDayOfInterval, format, isSameDay } from "date-fns";

interface BudgetInput {
  config: {
    range: { from: Date; to: Date };
    budget: number;
    startingBudget: number;
    dailyBudget: number;
  };
  transactions: Array<{
    credit: number;
    debit: number;
    date: Date;
  }>;
}

function groupByDate(
  entries: Array<{ amount: number; date: Date }>,
): Record<string, number> {
  return entries.reduce(
    (acc, { amount, date }) => {
      const key = format(new UTCDate(date), "yyyy-MM-dd");
      acc[key] = (acc[key] ?? 0) + amount;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export function useBudget({ config, transactions }: BudgetInput) {
  const today = new Date();

  const expensesByDate = groupByDate(
    transactions.map((t) => ({ amount: t.debit, date: t.date })),
  );
  const incomeByDate = groupByDate(
    transactions.map((t) => ({ amount: t.credit, date: t.date })),
  );

  const totalExpenses = Object.values(expensesByDate).reduce(
    (sum, n) => sum + n,
    0,
  );
  const totalIncome = Object.values(incomeByDate).reduce(
    (sum, n) => sum + n,
    0,
  );

  const totalBalance = config.budget - totalExpenses + totalIncome;
  const totalSpent = totalExpenses - totalIncome;

  let runningBalance = config.startingBudget || 0;
  const events = eachDayOfInterval({
    start: config.range.from,
    end: config.range.to,
  }).map((date, index) => {
    const key = format(new UTCDate(date), "yyyy-MM-dd");
    const expenses = expensesByDate[key] ?? 0;
    const income = incomeByDate[key] ?? 0;

    const startBalance =
      index === 0 ? runningBalance : config.dailyBudget + runningBalance;
    const endBalance = startBalance - expenses + income;
    runningBalance = endBalance;

    return { date, expenses, income, startBalance, endBalance };
  });

  const balanceToday =
    events.find(({ date }) => isSameDay(today, date))?.endBalance ?? 0;

  return {
    budget: config.budget,
    dailyBudget: config.dailyBudget,
    events,
    totalBalance,
    balanceToday,
    totalSpent,
  };
}
