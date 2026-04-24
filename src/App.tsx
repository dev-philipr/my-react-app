import { useState, useEffect, useId, useCallback } from "react";
import { useBudget } from "./hooks/use-budget";
import { Provider } from "./components/ui/provider";
import {
  Box,
  Heading,
  Container,
  Flex,
  Text,
  Badge,
  Grid,
  Separator,
  Stack,
  Input,
  Button,
  IconButton,
  Field,
} from "@chakra-ui/react";
import { format, parseISO } from "date-fns";
import {
  Pencil,
  Trash2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Check,
  Settings,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  credit: number;
  debit: number;
  date: string; // stored as ISO string "yyyy-MM-dd" for localStorage safety
}

interface BudgetConfig {
  rangeFrom: string; // "yyyy-MM-dd"
  rangeTo: string;
  budget: number;
  dailyBudget: number;
}

interface StatTileProps {
  label: string;
  value: number;
  isPositive?: boolean;
  sub?: string;
}

interface BudgetBarProps {
  spent: number;
  total: number;
}

interface ConfigPanelProps {
  config: BudgetConfig;
  onSave: (c: BudgetConfig) => void;
  onCancel: () => void;
}

interface TransactionFormProps {
  initial?: Partial<Transaction>;
  onSave: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

interface TxRowProps {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

interface EventCardProps {
  date: Date;
  startBalance: number;
  income: number;
  expenses: number;
  endBalance: number;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

interface EventRowProps extends EventCardProps {
  isLast: boolean;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE = {
  CONFIG: "budget_config_v1",
  TRANSACTIONS: "budget_transactions_v1",
} as const;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BudgetConfig = {
  rangeFrom: "2026-04-18",
  rangeTo: "2026-04-24",
  budget: 500,
  dailyBudget: 50,
};

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "seed1", credit: 0, debit: 7.5, date: "2026-04-18" },
  { id: "seed2", credit: 0, debit: 42.97, date: "2026-04-19" },
  { id: "seed3", credit: 125.12, debit: 76.67, date: "2026-04-20" },
  { id: "seed4", credit: 0, debit: 329.29, date: "2026-04-21" },
  { id: "seed6", credit: 40.97, debit: 52.58, date: "2026-04-23" },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadConfig(): BudgetConfig {
  try {
    const raw = localStorage.getItem(STORAGE.CONFIG);
    return raw ? (JSON.parse(raw) as BudgetConfig) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE.TRANSACTIONS);
    return raw ? (JSON.parse(raw) as Transaction[]) : DEFAULT_TRANSACTIONS;
  } catch {
    return DEFAULT_TRANSACTIONS;
  }
}

function saveConfig(c: BudgetConfig): void {
  localStorage.setItem(STORAGE.CONFIG, JSON.stringify(c));
}

function saveTransactions(txs: Transaction[]): void {
  localStorage.setItem(STORAGE.TRANSACTIONS, JSON.stringify(txs));
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Convert stored string date → Date object for useBudget
function txToDate(tx: Transaction): {
  credit: number;
  debit: number;
  date: Date;
} {
  return { credit: tx.credit, debit: tx.debit, date: parseISO(tx.date) };
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      letterSpacing="widest"
      textTransform="uppercase"
      color="fg.muted"
    >
      {children}
    </Text>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, isPositive, sub }: StatTileProps) {
  const numColor =
    isPositive === undefined ? "fg" : isPositive ? "green.500" : "red.500";
  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      px={6}
      py={5}
      flex="1"
      minW="150px"
      _hover={{ borderColor: "border.emphasized", shadow: "sm" }}
      transition="all 0.2s"
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.muted"
        mb={2}
      >
        {label}
      </Text>
      <Text
        fontSize="3xl"
        fontWeight="bold"
        letterSpacing="tight"
        color={numColor}
        lineHeight="1"
      >
        ${value.toFixed(2)}
      </Text>
      {sub && (
        <Text fontSize="xs" color="fg.subtle" mt={1.5}>
          {sub}
        </Text>
      )}
    </Box>
  );
}

// ─── BudgetBar ────────────────────────────────────────────────────────────────

function BudgetBar({ spent, total }: BudgetBarProps) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const barColor = pct > 85 ? "red.500" : pct > 60 ? "orange.400" : "green.500";
  return (
    <Box>
      <Flex justify="space-between" mb={1.5}>
        <Text fontSize="xs" color="fg.muted" fontWeight="medium">
          Spent
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {pct.toFixed(1)}%
        </Text>
      </Flex>
      <Box h="6px" bg="bg.muted" borderRadius="full" overflow="hidden">
        <Box
          h="100%"
          w={`${pct}%`}
          bg={barColor}
          borderRadius="full"
          transition="width 0.8s cubic-bezier(.16,1,.3,1)"
        />
      </Box>
      <Flex justify="space-between" mt={1.5}>
        <Text fontSize="xs" color="fg.subtle">
          ${(total - spent).toFixed(2)} remaining
        </Text>
        <Text fontSize="xs" color="fg.subtle">
          of ${total.toFixed(2)}
        </Text>
      </Flex>
    </Box>
  );
}

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

function ConfigPanel({ config, onSave, onCancel }: ConfigPanelProps) {
  const [draft, setDraft] = useState<BudgetConfig>({ ...config });

  function set<K extends keyof BudgetConfig>(key: K, val: BudgetConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  const isValid =
    draft.rangeFrom !== "" &&
    draft.rangeTo !== "" &&
    draft.rangeFrom <= draft.rangeTo &&
    draft.budget >= 0 &&
    draft.dailyBudget >= 0;

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="2xl"
      p={6}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.muted"
        mb={5}
      >
        Budget Configuration
      </Text>

      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }}
        gap={4}
        mb={5}
      >
        <Field.Root>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Period Start
          </Field.Label>
          <Input
            type="date"
            size="sm"
            borderRadius="lg"
            value={draft.rangeFrom}
            onChange={(e) => set("rangeFrom", e.target.value)}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Period End
          </Field.Label>
          <Input
            type="date"
            size="sm"
            borderRadius="lg"
            value={draft.rangeTo}
            onChange={(e) => set("rangeTo", e.target.value)}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Total Budget ($)
          </Field.Label>
          <Input
            type="number"
            size="sm"
            borderRadius="lg"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={draft.budget}
            onChange={(e) => set("budget", parseFloat(e.target.value) || 0)}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Daily Budget ($)
          </Field.Label>
          <Input
            type="number"
            size="sm"
            borderRadius="lg"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={draft.dailyBudget}
            onChange={(e) =>
              set("dailyBudget", parseFloat(e.target.value) || 0)
            }
          />
        </Field.Root>
      </Grid>

      <Flex gap={3} justify="flex-end">
        <Button size="sm" variant="ghost" borderRadius="lg" onClick={onCancel}>
          <X size={14} />
          Cancel
        </Button>
        <Button
          size="sm"
          colorPalette="purple"
          borderRadius="lg"
          disabled={!isValid}
          onClick={() => onSave(draft)}
        >
          <Check size={14} />
          Save config
        </Button>
      </Flex>
    </Box>
  );
}

// ─── TransactionForm ──────────────────────────────────────────────────────────

function TransactionForm({ initial, onSave, onCancel }: TransactionFormProps) {
  const dateId = useId();
  const creditId = useId();
  const debitId = useId();

  const [date, setDate] = useState<string>(
    initial?.date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [credit, setCredit] = useState<string>(
    initial?.credit != null && initial.credit > 0 ? String(initial.credit) : "",
  );
  const [debit, setDebit] = useState<string>(
    initial?.debit != null && initial.debit > 0 ? String(initial.debit) : "",
  );

  const isValid =
    date.trim() !== "" &&
    (credit.trim() !== "" || debit.trim() !== "") &&
    parseFloat(credit || "0") >= 0 &&
    parseFloat(debit || "0") >= 0;

  function handleSave() {
    if (!isValid) return;
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      date,
      credit: parseFloat(credit || "0"),
      debit: parseFloat(debit || "0"),
    });
  }

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="2xl"
      p={5}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.muted"
        mb={4}
      >
        {initial?.id ? "Edit Transaction" : "New Transaction"}
      </Text>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr 1fr" }} gap={4} mb={5}>
        <Field.Root id={dateId}>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Date
          </Field.Label>
          <Input
            type="date"
            size="sm"
            borderRadius="lg"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field.Root>

        <Field.Root id={creditId}>
          <Field.Label
            fontSize="xs"
            color="green.500"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Credit ($)
          </Field.Label>
          <Input
            type="number"
            size="sm"
            borderRadius="lg"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
          />
        </Field.Root>

        <Field.Root id={debitId}>
          <Field.Label
            fontSize="xs"
            color="red.500"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Debit ($)
          </Field.Label>
          <Input
            type="number"
            size="sm"
            borderRadius="lg"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={debit}
            onChange={(e) => setDebit(e.target.value)}
          />
        </Field.Root>
      </Grid>

      <Flex gap={3} justify="flex-end">
        <Button size="sm" variant="ghost" borderRadius="lg" onClick={onCancel}>
          <X size={14} />
          Cancel
        </Button>
        <Button
          size="sm"
          colorPalette="purple"
          borderRadius="lg"
          disabled={!isValid}
          onClick={handleSave}
        >
          <Check size={14} />
          {initial?.id ? "Save changes" : "Add transaction"}
        </Button>
      </Flex>
    </Box>
  );
}

// ─── TxRow ────────────────────────────────────────────────────────────────────

function TxRow({ tx, onEdit, onDelete }: TxRowProps) {
  return (
    <Flex
      align="center"
      justify="space-between"
      px={4}
      py={2.5}
      borderRadius="xl"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
      gap={3}
    >
      <Flex align="center" gap={3} flex="1" minW={0}>
        <Box
          w={1.5}
          h={1.5}
          borderRadius="full"
          bg={tx.credit > 0 ? "green.400" : "red.400"}
          flexShrink={0}
        />
        <Text
          fontSize="xs"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          flexShrink={0}
        >
          {tx.date}
        </Text>
        {tx.credit > 0 && (
          <Badge
            colorPalette="green"
            variant="subtle"
            borderRadius="full"
            fontSize="xs"
            px={2}
          >
            +${tx.credit.toFixed(2)}
          </Badge>
        )}
        {tx.debit > 0 && (
          <Badge
            colorPalette="red"
            variant="subtle"
            borderRadius="full"
            fontSize="xs"
            px={2}
          >
            −${tx.debit.toFixed(2)}
          </Badge>
        )}
      </Flex>
      <Flex gap={1} flexShrink={0}>
        <IconButton
          aria-label="Edit transaction"
          size="xs"
          variant="ghost"
          borderRadius="lg"
          onClick={() => onEdit(tx)}
        >
          <Pencil size={13} />
        </IconButton>
        <IconButton
          aria-label="Delete transaction"
          size="xs"
          variant="ghost"
          colorPalette="red"
          borderRadius="lg"
          onClick={() => onDelete(tx.id)}
        >
          <Trash2 size={13} />
        </IconButton>
      </Flex>
    </Flex>
  );
}

// ─── EventCard (mobile) ───────────────────────────────────────────────────────

function EventCard({
  date,
  startBalance,
  income,
  expenses,
  endBalance,
  transactions,
  onEdit,
  onDelete,
}: EventCardProps) {
  const isUp = endBalance >= 0;

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      overflow="hidden"
      _hover={{ borderColor: "border.emphasized", shadow: "sm" }}
      transition="all 0.2s"
    >
      {/* Header */}
      <Flex
        px={5}
        py={3.5}
        bg="bg.muted"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        justify="space-between"
        align="center"
      >
        <Flex align="center" gap={2.5}>
          {isUp ? (
            <TrendingUp size={14} color="var(--chakra-colors-green-400)" />
          ) : (
            <TrendingDown size={14} color="var(--chakra-colors-red-400)" />
          )}
          <Text
            fontSize="sm"
            fontWeight="bold"
            color="fg"
            letterSpacing="tight"
          >
            {format(date, "MMM dd, yyyy")}
          </Text>
        </Flex>
        <Badge
          colorPalette={isUp ? "green" : "red"}
          variant="subtle"
          borderRadius="full"
          px={2.5}
          fontSize="xs"
        >
          {isUp ? "+" : "−"}${Math.abs(endBalance).toFixed(2)}
        </Badge>
      </Flex>

      {/* 2×2 stats */}
      <Grid templateColumns="1fr 1fr" gap={0}>
        <Box
          px={5}
          py={4}
          borderRightWidth="1px"
          borderColor="border.subtle"
          borderBottomWidth="1px"
        >
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
            mb={1}
          >
            Start
          </Text>
          <Text
            fontSize="md"
            fontWeight="semibold"
            color="fg.muted"
            fontVariantNumeric="tabular-nums"
          >
            ${startBalance.toFixed(2)}
          </Text>
        </Box>
        <Box px={5} py={4} borderBottomWidth="1px" borderColor="border.subtle">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
            mb={1}
          >
            End
          </Text>
          <Text
            fontSize="md"
            fontWeight="bold"
            color={isUp ? "green.500" : "red.500"}
            fontVariantNumeric="tabular-nums"
          >
            ${endBalance.toFixed(2)}
          </Text>
        </Box>
        <Box px={5} py={4} borderRightWidth="1px" borderColor="border.subtle">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
            mb={1}
          >
            Income
          </Text>
          <Text
            fontSize="md"
            fontWeight="semibold"
            color={income > 0 ? "green.500" : "fg.subtle"}
            fontVariantNumeric="tabular-nums"
          >
            {income > 0 ? `+$${income.toFixed(2)}` : "—"}
          </Text>
        </Box>
        <Box px={5} py={4}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
            mb={1}
          >
            Expenses
          </Text>
          <Text
            fontSize="md"
            fontWeight="semibold"
            color={expenses > 0 ? "red.500" : "fg.subtle"}
            fontVariantNumeric="tabular-nums"
          >
            {expenses > 0 ? `-$${expenses.toFixed(2)}` : "—"}
          </Text>
        </Box>
      </Grid>

      {transactions.length > 0 && (
        <Box borderTopWidth="1px" borderColor="border.subtle" pt={2} pb={2}>
          {transactions.map((tx) => (
            <TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── EventRow (desktop) ───────────────────────────────────────────────────────

function EventRow({
  date,
  startBalance,
  income,
  expenses,
  endBalance,
  transactions,
  onEdit,
  onDelete,
  isLast,
}: EventRowProps) {
  const delta = endBalance - startBalance;
  const isUp = delta >= 0;
  const [open, setOpen] = useState(false);
  const hasTransactions = transactions.length > 0;

  return (
    <Box>
      <Grid
        templateColumns="1.6fr 1fr 1fr 1fr 1.2fr auto"
        gap={3}
        px={5}
        py={3.5}
        alignItems="center"
        _hover={{ bg: "bg.muted" }}
        transition="background 0.15s"
        borderRadius="xl"
        cursor={hasTransactions ? "pointer" : "default"}
        onClick={() => hasTransactions && setOpen((p) => !p)}
      >
        <Flex align="center" gap={3}>
          {isUp ? (
            <TrendingUp size={14} color="var(--chakra-colors-green-400)" />
          ) : (
            <TrendingDown size={14} color="var(--chakra-colors-red-400)" />
          )}
          <Text fontSize="sm" fontWeight="semibold" color="fg">
            {format(date, "MMM dd, yyyy")}
          </Text>
        </Flex>
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          ${startBalance.toFixed(2)}
        </Text>
        <Text
          fontSize="sm"
          color={income > 0 ? "green.500" : "fg.subtle"}
          fontVariantNumeric="tabular-nums"
        >
          {income > 0 ? `+$${income.toFixed(2)}` : "—"}
        </Text>
        <Text
          fontSize="sm"
          color={expenses > 0 ? "red.500" : "fg.subtle"}
          fontVariantNumeric="tabular-nums"
        >
          {expenses > 0 ? `-$${expenses.toFixed(2)}` : "—"}
        </Text>
        <Flex align="center" justify="space-between" gap={2}>
          <Text
            fontSize="sm"
            fontWeight="bold"
            color={isUp ? "green.500" : "red.500"}
            fontVariantNumeric="tabular-nums"
          >
            ${endBalance.toFixed(2)}
          </Text>
          <Badge
            size="sm"
            colorPalette={isUp ? "green" : "red"}
            variant="subtle"
            borderRadius="full"
            px={2}
          >
            {isUp ? "+" : "−"}${Math.abs(delta).toFixed(2)}
          </Badge>
        </Flex>
        <Flex w={5} justify="center" color="fg.subtle">
          {hasTransactions ? (
            open ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )
          ) : null}
        </Flex>
      </Grid>

      {open && hasTransactions && (
        <Box
          mx={5}
          mb={2}
          bg="bg.muted"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
          overflow="hidden"
        >
          {transactions.map((tx) => (
            <TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Box>
      )}

      {!isLast && <Separator opacity={0.06} />}
    </Box>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Persisted state ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<BudgetConfig>(loadConfig);
  const [transactions, setTransactions] =
    useState<Transaction[]>(loadTransactions);

  // Persist on every change
  useEffect(() => {
    saveConfig(config);
  }, [config]);
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showConfig, setShowConfig] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // ── useBudget ────────────────────────────────────────────────────────────────
  // useBudget expects Date objects so we map on the way in
  const budgetInput = {
    config: {
      range: {
        from: parseISO(config.rangeFrom),
        to: parseISO(config.rangeTo),
      },
      budget: config.budget,
      dailyBudget: config.dailyBudget,
    },
    transactions: transactions.map(txToDate),
  };

  const { budget, dailyBudget, events, totalBalance, balanceToday } =
    useBudget(budgetInput);

  const totalSpent = budget - totalBalance;

  // ── Enrich events with their source transactions ──────────────────────────
  const enrichedEvents = events.map((ev) => ({
    ...ev,
    transactions: transactions.filter(
      (tx) => tx.date === format(ev.date, "yyyy-MM-dd"),
    ),
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveConfig = useCallback((c: BudgetConfig) => {
    setConfig(c);
    setShowConfig(false);
  }, []);

  const handleSaveTx = useCallback(
    (data: Omit<Transaction, "id"> & { id?: string }) => {
      setTransactions((prev) => {
        const updated = data.id
          ? prev.map((tx) =>
              tx.id === data.id ? { ...data, id: data.id! } : tx,
            )
          : [...prev, { ...data, id: genId() }];
        return updated;
      });
      setShowForm(false);
      setEditingTx(null);
    },
    [],
  );

  const handleDelete = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  const handleEdit = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setShowForm(false);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingTx(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Provider>
      <Box minH="100vh" bg="bg" pt={12} pb={20}>
        <Container maxW="900px">
          <Stack gap={10}>
            {/* ── Header ── */}
            <Stack gap={3}>
              <Flex align="center" gap={2} wrap="wrap">
                <Badge
                  colorPalette="purple"
                  variant="subtle"
                  borderRadius="full"
                  px={3}
                  py={1}
                  fontSize="xs"
                  letterSpacing="wide"
                >
                  {format(parseISO(config.rangeFrom), "MMM d")} –{" "}
                  {format(parseISO(config.rangeTo), "MMM d, yyyy")}
                </Badge>
                <Badge
                  colorPalette="gray"
                  variant="outline"
                  borderRadius="full"
                  px={3}
                  py={1}
                  fontSize="xs"
                >
                  {events.length} days
                </Badge>
              </Flex>

              <Flex justify="space-between" align="flex-start" gap={4}>
                <Heading
                  size="4xl"
                  fontWeight="black"
                  letterSpacing="-0.04em"
                  color="fg"
                  lineHeight="1"
                >
                  Budget{" "}
                  <Box as="span" color="fg.muted" fontWeight="light">
                    overview
                  </Box>
                </Heading>

                <Button
                  size="sm"
                  variant={showConfig ? "solid" : "outline"}
                  colorPalette={showConfig ? "purple" : "gray"}
                  borderRadius="xl"
                  flexShrink={0}
                  mt={1}
                  onClick={() => {
                    setShowConfig((p) => !p);
                  }}
                >
                  {showConfig ? <X size={14} /> : <Settings size={14} />}
                  {showConfig ? "Close" : "Configure"}
                </Button>
              </Flex>
            </Stack>

            {/* ── Config Panel ── */}
            {showConfig && (
              <ConfigPanel
                config={config}
                onSave={handleSaveConfig}
                onCancel={() => setShowConfig(false)}
              />
            )}

            {/* ── Stat Cards ── */}
            <Flex gap={4} wrap="wrap">
              <StatTile
                label="Total Budget"
                value={budget}
                sub="period allocation"
              />
              <StatTile
                label="Daily Budget"
                value={dailyBudget}
                sub="per day limit"
              />
              <StatTile
                label="Total Balance"
                value={totalBalance}
                isPositive={totalBalance >= 0}
                sub={
                  budget > 0
                    ? `${((totalBalance / budget) * 100).toFixed(1)}% of budget left`
                    : undefined
                }
              />
              <StatTile
                label="Today's Balance"
                value={balanceToday}
                isPositive={balanceToday >= 0}
                sub="vs daily limit"
              />
            </Flex>

            {/* ── Budget Burn ── */}
            <Box
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="2xl"
              px={7}
              py={6}
            >
              <Text
                fontSize="xs"
                fontWeight="semibold"
                letterSpacing="widest"
                textTransform="uppercase"
                color="fg.muted"
                mb={4}
              >
                Period Burn
              </Text>
              <BudgetBar spent={totalSpent} total={budget} />
            </Box>

            {/* ── Daily Events ── */}
            <Stack gap={4}>
              <Flex justify="space-between" align="center">
                <SectionLabel>Daily Events</SectionLabel>
                <Flex gap={2} align="center">
                  <Text fontSize="xs" color="fg.subtle">
                    Total spent:{" "}
                    <Box as="span" color="fg" fontWeight="semibold">
                      ${totalSpent.toFixed(2)}
                    </Box>
                  </Text>
                  <Button
                    size="xs"
                    colorPalette="purple"
                    variant="subtle"
                    borderRadius="lg"
                    onClick={() => {
                      setShowForm((p) => !p);
                      setEditingTx(null);
                    }}
                  >
                    {showForm ? <X size={12} /> : <Plus size={12} />}
                    {showForm ? "Cancel" : "Add"}
                  </Button>
                </Flex>
              </Flex>

              {/* Add form */}
              {showForm && (
                <TransactionForm
                  onSave={handleSaveTx}
                  onCancel={handleCancelForm}
                />
              )}

              {/* Edit form */}
              {editingTx && (
                <TransactionForm
                  initial={editingTx}
                  onSave={handleSaveTx}
                  onCancel={handleCancelForm}
                />
              )}

              {events.length === 0 ? (
                <Flex
                  justify="center"
                  align="center"
                  py={16}
                  direction="column"
                  gap={2}
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="2xl"
                >
                  <Text fontSize="2xl" color="fg.subtle">
                    —
                  </Text>
                  <Text fontSize="sm" color="fg.subtle">
                    No events in this period
                  </Text>
                </Flex>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <Stack gap={3} display={{ base: "flex", md: "none" }}>
                    {enrichedEvents.map((ev, idx) => (
                      <EventCard
                        key={idx}
                        {...ev}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </Stack>

                  {/* Desktop: table */}
                  <Box
                    display={{ base: "none", md: "block" }}
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderRadius="2xl"
                    overflow="hidden"
                  >
                    <Grid
                      templateColumns="1.6fr 1fr 1fr 1fr 1.2fr auto"
                      gap={3}
                      px={5}
                      py={3}
                      bg="bg.muted"
                      borderBottomWidth="1px"
                      borderColor="border.subtle"
                    >
                      {[
                        "Date",
                        "Start",
                        "Income",
                        "Expenses",
                        "End Balance",
                        "",
                      ].map((h) => (
                        <Text
                          key={h}
                          fontSize="xs"
                          fontWeight="semibold"
                          letterSpacing="widest"
                          textTransform="uppercase"
                          color="fg.subtle"
                        >
                          {h}
                        </Text>
                      ))}
                    </Grid>

                    <Box py={2}>
                      {enrichedEvents.map((ev, idx) => (
                        <EventRow
                          key={idx}
                          {...ev}
                          isLast={idx === enrichedEvents.length - 1}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </Box>

                    <Flex
                      px={5}
                      py={3}
                      borderTopWidth="1px"
                      borderColor="border.subtle"
                      justify="space-between"
                      align="center"
                      bg="bg.muted"
                    >
                      <Text fontSize="xs" color="fg.subtle">
                        {events.length} day{events.length !== 1 ? "s" : ""}{" "}
                        tracked
                      </Text>
                      <Text fontSize="xs" color="fg.subtle">
                        {transactions.length} transaction
                        {transactions.length !== 1 ? "s" : ""}
                      </Text>
                    </Flex>
                  </Box>
                </>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Provider>
  );
}
