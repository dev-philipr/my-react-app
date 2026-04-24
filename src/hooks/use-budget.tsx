import { eachDayOfInterval, format } from "date-fns";

interface UseBudgetProps {
  config: {
    range: {
      from: Date;
      to: Date;
    };
    budget: number;
    dailyBudget: number;
  };
  transactions: {
    credit: number; // income
    debit: number; // expenses
    date: Date;
  }[];
}

export const useBudget = ({ config, transactions }: UseBudgetProps) => {
  const today = new Date();
  const datesInRange = eachDayOfInterval({
    start: config.range.from,
    end: config.range.to,
  });

  const expenses = transactions.reduce(
    (acc, { debit, date }) => {
      const formattedDate = format(date, "yyyy-MM-dd");

      if (!acc[formattedDate]) {
        acc[formattedDate] = 0;
      }

      acc[formattedDate] += debit;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalExpenses = Object.values(expenses).reduce(
    (acc, exp) => (acc += exp),
    0,
  );

  const totalBalance = config.budget - totalExpenses;

  const income = transactions.reduce(
    (acc, { credit, date }) => {
      const formattedDate = format(date, "yyyy-MM-dd");

      if (!acc[formattedDate]) {
        acc[formattedDate] = 0;
      }

      acc[formattedDate] += credit;
      return acc;
    },
    {} as Record<string, number>,
  );

  let accumulator = 0;
  const events = datesInRange.map((date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    const exp = expenses[formattedDate] || 0;
    const inc = income[formattedDate] || 0;

    const startBalance = config.dailyBudget + accumulator;
    const endBalance = startBalance - exp + inc;
    accumulator = endBalance;

    return {
      date,
      expenses: exp,
      income: inc,
      startBalance,
      endBalance,
    };
  });

  const balanceToday =
    events.find(({ date }) => date === today)?.endBalance || 0;

  return {
    budget: config.budget,
    dailyBudget: config.dailyBudget,
    events,
    totalBalance,
    balanceToday,
  };
};
