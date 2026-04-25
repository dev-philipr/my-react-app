import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
  Badge,
  Box,
  Button,
  CloseButton,
  Container,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerPositioner,
  DrawerRoot,
  DrawerTrigger,
  Field,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  Portal,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { UTCDate } from "@date-fns/utc";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useColorMode } from "./components/ui/color-mode";
import { useBudget } from "./hooks/use-budget";
import type {
  BudgetConfig,
  BudgetEntry,
  Transaction,
} from "./hooks/use-budgets";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  onCancel?: () => void;
}

interface TransactionFormProps {
  initial?: Partial<Transaction>;
  onSave: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
  onCancel: () => void;
  lockedDate?: string;
}

interface TxRowProps {
  tx: Transaction;
  onEdit: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
  onDelete: (id: string) => void;
}

interface EventCardProps {
  date: Date;
  startBalance: number;
  income: number;
  expenses: number;
  endBalance: number;
  transactions: Transaction[];
  onEdit: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
  onDelete: (id: string) => void;
  onQuickSave: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
}

interface EventRowProps extends Omit<EventCardProps, "onQuickSave"> {
  isLast: boolean;
}

interface QuickAddRowProps {
  date: string;
  initial?: Transaction;
  saveLabel?: string;
  onSave: (tx: Omit<Transaction, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

interface BudgetDetailProps {
  getBudgetEntry: (id: string) => BudgetEntry | null;
  updateBudgetConfig: (id: string, config: BudgetConfig) => void;
  upsertTransaction: (
    budgetId: string,
    tx: Omit<Transaction, "id"> & { id?: string },
  ) => void;
  deleteTransaction: (budgetId: string, txId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function txToDate(tx: Transaction) {
  return { credit: tx.credit, debit: tx.debit, date: parseISO(tx.date) };
}

function txDisplayName(tx: Transaction): { text: string; isLegacy: boolean } {
  if (tx.name && tx.name.trim() !== "")
    return { text: tx.name.trim(), isLegacy: false };
  return { text: "unlabelled", isLegacy: true };
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

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

// ─── ColorModeToggle ──────────────────────────────────────────────────────────

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <IconButton
      pt="1"
      aria-label="Toggle color mode"
      size="sm"
      variant="ghost"
      borderRadius="xl"
      onClick={toggleColorMode}
    >
      {colorMode === "light" ? <Moon size={15} /> : <Sun size={15} />}
    </IconButton>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, isPositive, sub }: StatTileProps) {
  const numColor =
    isPositive === undefined ? "fg" : isPositive ? "green.500" : "red.500";
  const val = value.toFixed(2);
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
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.muted"
        mb={2}
      >
        {label}
      </Text>
      <Text
        fontSize={{ base: val.length > 6 ? "md" : "lg" }}
        fontWeight="bold"
        letterSpacing="tight"
        color={numColor}
        lineHeight="1"
      >
        ${val}
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
            Total Budget
          </Field.Label>
          <InputGroup
            startElement={
              <Text fontSize="xs" color="fg.muted">
                $
              </Text>
            }
          >
            <Input
              type="number"
              size="sm"
              borderRadius="lg"
              placeholder="0.00"
              min={0}
              step={0.01}
              value={draft.budget || ""}
              onChange={(e) => set("budget", parseFloat(e.target.value) || 0)}
            />
          </InputGroup>
        </Field.Root>
        <Field.Root>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Daily Budget
          </Field.Label>
          <InputGroup
            startElement={
              <Text fontSize="xs" color="fg.muted">
                $
              </Text>
            }
          >
            <Input
              type="number"
              size="sm"
              borderRadius="lg"
              placeholder="0.00"
              min={0}
              step={0.01}
              value={draft.dailyBudget || ""}
              onChange={(e) =>
                set("dailyBudget", parseFloat(e.target.value) || 0)
              }
            />
          </InputGroup>
        </Field.Root>
      </Grid>
      <Flex gap={3} justify="flex-end">
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            borderRadius="lg"
            onClick={onCancel}
          >
            <X size={14} />
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          colorPalette="green"
          borderRadius="lg"
          disabled={!isValid}
          onClick={() => onSave(draft)}
        >
          <Check size={14} />
          Save
        </Button>
      </Flex>
    </Box>
  );
}

// ─── TransactionForm ──────────────────────────────────────────────────────────

function TransactionForm({
  initial,
  onSave,
  onCancel,
  lockedDate,
}: TransactionFormProps) {
  const dateId = useId();
  const nameId = useId();
  const creditId = useId();
  const debitId = useId();
  const [date, setDate] = useState<string>(
    lockedDate ?? initial?.date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [name, setName] = useState<string>(initial?.name ?? "");
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
      name: name.trim() || undefined,
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
        {lockedDate && (
          <Box
            as="span"
            ml={2}
            px={2}
            py={0.5}
            bg="green.subtle"
            color="green.fg"
            borderRadius="full"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wider"
          >
            {format(parseISO(lockedDate), "MMM d")}
          </Box>
        )}
      </Text>
      <Grid
        templateColumns={{ base: "1fr", sm: lockedDate ? "1fr" : "auto 1fr" }}
        gap={4}
        mb={4}
      >
        {!lockedDate && (
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
        )}
        <Field.Root id={nameId}>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Label{" "}
            <Box
              as="span"
              color="fg.subtle"
              fontWeight="normal"
              textTransform="none"
              letterSpacing="normal"
              ml={1}
            >
              (optional)
            </Box>
          </Field.Label>
          <Input
            size="sm"
            borderRadius="lg"
            placeholder="e.g. Groceries, Coffee, Salary…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field.Root>
      </Grid>
      <Grid templateColumns={{ base: "1fr 1fr" }} gap={4} mb={5}>
        <Field.Root id={creditId}>
          <Field.Label
            fontSize="xs"
            color="green.500"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Credit
          </Field.Label>
          <InputGroup
            startElement={
              <Text fontSize="xs" color="fg.muted">
                $
              </Text>
            }
          >
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
          </InputGroup>
        </Field.Root>
        <Field.Root id={debitId}>
          <Field.Label
            fontSize="xs"
            color="red.500"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Debit
          </Field.Label>
          <InputGroup
            startElement={
              <Text fontSize="xs" color="fg.muted">
                $
              </Text>
            }
          >
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
          </InputGroup>
        </Field.Root>
      </Grid>
      <Flex gap={3} justify="flex-end">
        <Button size="sm" variant="ghost" borderRadius="lg" onClick={onCancel}>
          <X size={14} />
          Cancel
        </Button>
        <Button
          size="sm"
          colorPalette="green"
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

// ─── QuickAddRow ──────────────────────────────────────────────────────────────

function QuickAddRow({
  date,
  initial,
  saveLabel = "Add",
  onSave,
  onCancel,
}: QuickAddRowProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial
      ? String((initial.debit > 0 ? initial.debit : initial.credit) || "")
      : "",
  );
  const [type, setType] = useState<"debit" | "credit">(
    initial ? (initial.credit > 0 ? "credit" : "debit") : "debit",
  );
  const isValid = amount.trim() !== "" && parseFloat(amount) > 0;

  function handleSave() {
    if (!isValid) return;
    const val = parseFloat(amount);
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      date,
      name: name.trim() || undefined,
      credit: type === "credit" ? val : 0,
      debit: type === "debit" ? val : 0,
    });
    setName("");
    setAmount("");
  }

  return (
    <Box
      px={4}
      py={3}
      borderTopWidth="1px"
      borderColor="border.subtle"
      bg="bg.canvas"
    >
      <Flex gap={1.5} mb={3}>
        <Button
          size="xs"
          variant={type === "debit" ? "solid" : "outline"}
          colorPalette={type === "debit" ? "red" : "gray"}
          borderRadius="full"
          flex="1"
          onClick={() => setType("debit")}
        >
          − Expense
        </Button>
        <Button
          size="xs"
          variant={type === "credit" ? "solid" : "outline"}
          colorPalette={type === "credit" ? "green" : "gray"}
          borderRadius="full"
          flex="1"
          onClick={() => setType("credit")}
        >
          + Income
        </Button>
      </Flex>
      <Flex gap={2} mb={2}>
        <Input
          size="sm"
          borderRadius="lg"
          placeholder="Label (optional)"
          value={name}
          flex="1"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <InputGroup
          startElement={
            <Text fontSize="xs" color="fg.muted">
              $
            </Text>
          }
          w="28"
          flexShrink={0}
        >
          <Input
            size="sm"
            borderRadius="lg"
            placeholder="0.00"
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </InputGroup>
      </Flex>
      <Flex gap={2} justify="flex-end">
        <Button size="xs" variant="ghost" borderRadius="lg" onClick={onCancel}>
          <X size={12} />
          Cancel
        </Button>
        <Button
          size="xs"
          colorPalette="green"
          borderRadius="lg"
          disabled={!isValid}
          onClick={handleSave}
        >
          <Check size={12} />
          {saveLabel}
        </Button>
      </Flex>
    </Box>
  );
}

// ─── TxRow ────────────────────────────────────────────────────────────────────

function TxRow({ tx, onEdit, onDelete }: TxRowProps) {
  const { text: nameText, isLegacy } = txDisplayName(tx);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <QuickAddRow
        date={tx.date}
        initial={tx}
        saveLabel="Save"
        onSave={(updated) => {
          onEdit(updated as Transaction);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

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
          fontSize="sm"
          fontWeight={isLegacy ? "normal" : "medium"}
          color={isLegacy ? "fg.subtle" : "fg"}
          fontStyle={isLegacy ? "italic" : "normal"}
          truncate
          flex="1"
          minW={0}
        >
          {nameText}
        </Text>
        <Text
          fontSize="xs"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          flexShrink={0}
        >
          {format(new UTCDate(tx.date), "MMM dd")}
        </Text>
        {tx.credit > 0 && (
          <Badge
            colorPalette="green"
            variant="subtle"
            borderRadius="full"
            fontSize="xs"
            px={2}
            flexShrink={0}
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
            flexShrink={0}
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
          onClick={() => setEditing(true)}
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
          <Icon color="red.500">
            <Trash2 size={13} />
          </Icon>
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
  onQuickSave,
}: EventCardProps) {
  const isUp = endBalance >= 0;
  const hasTransactions = transactions.length > 0;
  const dateStr = format(date, "yyyy-MM-dd");
  const [quickAdd, setQuickAdd] = useState(false);

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
      <AccordionRoot collapsible variant="plain">
        <AccordionItem value="transactions">
          <AccordionItemTrigger
            px={5}
            py={3.5}
            bg="bg.muted"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            _hover={
              hasTransactions ? { bg: "bg.emphasized" } : { bg: "bg.muted" }
            }
            cursor={hasTransactions ? "pointer" : "default"}
          >
            <Flex justify="space-between" align="center" w="100%">
              <Flex align="center" gap={2.5}>
                {isUp ? (
                  <TrendingUp
                    size={14}
                    color="var(--chakra-colors-green-400)"
                  />
                ) : (
                  <TrendingDown
                    size={14}
                    color="var(--chakra-colors-red-400)"
                  />
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
              <Flex align="center" gap={2}>
                <Badge
                  colorPalette={isUp ? "green" : "red"}
                  variant="subtle"
                  borderRadius="full"
                  px={2.5}
                  fontSize="xs"
                >
                  {isUp ? "+" : "−"}${Math.abs(endBalance).toFixed(2)}
                </Badge>
                {hasTransactions && (
                  <Text fontSize="xs" color="fg.subtle">
                    {transactions.length}
                  </Text>
                )}
              </Flex>
            </Flex>
          </AccordionItemTrigger>

          <Grid templateColumns="1fr 1fr">
            <Box
              px={5}
              py={4}
              borderRightWidth="1px"
              borderBottomWidth="1px"
              borderColor="border.subtle"
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
            <Box
              px={5}
              py={4}
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
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
            <Box
              px={5}
              py={4}
              borderRightWidth="1px"
              borderColor="border.subtle"
            >
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
                Balance
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
          </Grid>

          <AccordionItemContent px={0} pb={0}>
            <Separator />
            <Box borderTopWidth="1px" borderColor="border.subtle" pt={2} pb={2}>
              {transactions.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </Box>
          </AccordionItemContent>
        </AccordionItem>
      </AccordionRoot>

      <Separator />

      {quickAdd ? (
        <QuickAddRow
          date={dateStr}
          onSave={(tx) => {
            onQuickSave(tx);
            setQuickAdd(false);
          }}
          onCancel={() => setQuickAdd(false)}
        />
      ) : (
        <Flex
          px={4}
          py={2.5}
          borderTopWidth="1px"
          borderColor="border.subtle"
          justify="flex-end"
          bg="bg.canvas"
        >
          <Button
            size="xs"
            variant="ghost"
            colorPalette="green"
            borderRadius="lg"
            color="fg.subtle"
            fontSize="xs"
            onClick={() => setQuickAdd(true)}
          >
            <Zap size={11} /> Quick add
          </Button>
        </Flex>
      )}
    </Box>
  );
}

// ─── EventRow (desktop) ───────────────────────────────────────────────────────

const TABLE_COLUMNS = "1.8fr 1fr 1fr 1fr 1fr 1fr";
const TABLE_HEADERS = [
  "Date",
  "Start",
  "Expenses",
  "Income",
  "Balance",
  "Transactions",
];

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
    <>
      <GridItem
        px={5}
        py={3.5}
        alignSelf="center"
        _hover={{ bg: "bg.muted" }}
        transition="background 0.15s"
        borderRadius="xl"
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
      </GridItem>
      <GridItem alignSelf="center" py={3.5}>
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          ${startBalance.toFixed(2)}
        </Text>
      </GridItem>
      <GridItem alignSelf="center" py={3.5}>
        <Text
          fontSize="sm"
          color={expenses > 0 ? "red.500" : "fg.subtle"}
          fontVariantNumeric="tabular-nums"
        >
          {expenses > 0 ? `-$${expenses.toFixed(2)}` : "—"}
        </Text>
      </GridItem>
      <GridItem alignSelf="center" py={3.5}>
        <Text
          fontSize="sm"
          color={income > 0 ? "green.500" : "fg.subtle"}
          fontVariantNumeric="tabular-nums"
        >
          {income > 0 ? `+$${income.toFixed(2)}` : "—"}
        </Text>
      </GridItem>
      <GridItem alignSelf="center" py={3.5}>
        <Text
          fontSize="sm"
          fontWeight="bold"
          color={isUp ? "green.500" : "red.500"}
          fontVariantNumeric="tabular-nums"
        >
          ${endBalance.toFixed(2)}
        </Text>
      </GridItem>
      <GridItem alignSelf="center" py={3.5} pr={5}>
        <Flex gap="2" alignItems="center">
          <Badge
            size="sm"
            colorPalette={isUp ? "green" : "red"}
            variant="subtle"
            borderRadius="full"
            height="min-content"
            px={2}
          >
            {isUp ? "+" : "−"}${Math.abs(delta).toFixed(2)}
          </Badge>
          {hasTransactions && (
            <Button
              size="xs"
              variant="ghost"
              borderRadius="lg"
              color="fg.subtle"
              onClick={() => setOpen((p) => !p)}
            >
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <Text fontSize="xs" color="fg.subtle">
                {transactions.length}
              </Text>
            </Button>
          )}
        </Flex>
      </GridItem>
      {open && hasTransactions && (
        <GridItem colSpan={6} px={5} pb={2}>
          <Box
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
        </GridItem>
      )}
      {!isLast && (
        <GridItem colSpan={6}>
          <Separator opacity={0.06} />
        </GridItem>
      )}
    </>
  );
}

// ─── MethodDrawer ─────────────────────────────────────────────────────────────

const METHOD_STEPS = [
  {
    n: "01",
    title: "Set a period",
    desc: "Choose a start and end date — a trip, a pay cycle, a project window. Decide the total you can spend across it.",
  },
  {
    n: "02",
    title: "Daily allowance",
    desc: "Each day opens with a fixed allocation. Spend less and the surplus carries into tomorrow. Overspend and your next days shrink to compensate — automatically.",
  },
  {
    n: "03",
    title: "Log transactions",
    desc: "Record what comes in (credits) and goes out (debits). The running balance tells you exactly where you stand in real time.",
  },
  {
    n: "04",
    title: "Watch the burn",
    desc: "The period burn bar shows whether you're pacing ahead or behind. One glance tells you if today is a spend day or a save day.",
  },
];

const METHOD_USE_CASES = [
  "Daily pocket money",
  "Discretionary spending on trips",
  "Fun money within a pay cycle",
  "Eating out, coffee, impulse buys",
];

export function MethodDrawer() {
  return (
    <DrawerRoot placement="end" size="sm">
      <DrawerTrigger asChild>
        <Button
          size="xs"
          variant="plain"
          borderBottom="1px solid"
          borderBottomColor="gray.200"
          borderRadius="none"
        >
          Why?
        </Button>
      </DrawerTrigger>
      <Portal>
        <DrawerBackdrop />
        <DrawerPositioner>
          <DrawerContent borderRadius="2xl" m={3}>
            <DrawerHeader
              borderBottomWidth="1px"
              borderColor="border.subtle"
              pb="2"
            >
              <Flex align="center" gap={2.5}>
                <Box
                  w={2}
                  h={2}
                  borderRadius="full"
                  bg="green.400"
                  flexShrink={0}
                />
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  How this budget works
                </Text>
              </Flex>
            </DrawerHeader>
            <DrawerBody py={5}>
              <Stack gap={6}>
                <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                  This tracker converts your total budget into a daily
                  allowance. Unspent balance carries forward — frugal days build
                  a cushion for bigger ones.
                </Text>
                <Separator />
                <Stack gap={4}>
                  <SectionLabel>How it works</SectionLabel>
                  {METHOD_STEPS.map(({ n, title, desc }) => (
                    <Flex key={n} gap={3} align="flex-start">
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        color="green.500"
                        flexShrink={0}
                        mt={0.5}
                        minW="18px"
                      >
                        {n}
                      </Text>
                      <Box>
                        <Text
                          fontSize="sm"
                          fontWeight="semibold"
                          color="fg"
                          mb={1}
                        >
                          {title}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                          {desc}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                </Stack>
                <Separator />
                <Stack gap={3}>
                  <SectionLabel>When to use it</SectionLabel>
                  <Stack gap={2}>
                    {METHOD_USE_CASES.map((uc) => (
                      <Flex key={uc} align="center" gap={2.5}>
                        <Box
                          w={1.5}
                          h={1.5}
                          borderRadius="full"
                          bg="green.400"
                          flexShrink={0}
                        />
                        <Text fontSize="sm" color="fg.muted">
                          {uc}
                        </Text>
                      </Flex>
                    ))}
                  </Stack>
                </Stack>
                <Separator />
                <Box
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="xl"
                  px={4}
                  py={3.5}
                >
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="green.500"
                    letterSpacing="wider"
                    textTransform="uppercase"
                    mb={2}
                  >
                    Why it works
                  </Text>
                  <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                    Most budgets fail because the limit feels distant. A daily
                    allowance makes every decision immediate.
                  </Text>
                </Box>
              </Stack>
            </DrawerBody>
            <DrawerCloseTrigger>
              <CloseButton size="sm" />
            </DrawerCloseTrigger>
          </DrawerContent>
        </DrawerPositioner>
      </Portal>
    </DrawerRoot>
  );
}

// ─── BudgetDetail page ────────────────────────────────────────────────────────

export default function BudgetDetail({
  getBudgetEntry,
  updateBudgetConfig,
  upsertTransaction,
  deleteTransaction,
}: BudgetDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const entry = useMemo(() => {
    if (!id) return null;
    return getBudgetEntry(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getBudgetEntry, tick]);

  const [showConfig, setShowConfig] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSaveConfig = useCallback(
    (c: BudgetConfig) => {
      if (!id) return;
      updateBudgetConfig(id, c);
      setShowConfig(false);
      bump();
    },
    [id, updateBudgetConfig, bump],
  );

  const handleSaveTx = useCallback(
    (data: Omit<Transaction, "id"> & { id?: string }) => {
      if (!id) return;
      upsertTransaction(id, data);
      setShowForm(false);
      bump();
    },
    [id, upsertTransaction, bump],
  );

  const handleDelete = useCallback(
    (txId: string) => {
      if (!id) return;
      deleteTransaction(id, txId);
      bump();
    },
    [id, deleteTransaction, bump],
  );

  if (!entry) {
    return (
      <Box
        minH="100vh"
        bg="bg"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Stack align="center" gap={4}>
          <Text fontSize="4xl">🔍</Text>
          <Text color="fg.muted">Budget not found.</Text>
          <Button
            colorPalette="green"
            borderRadius="xl"
            onClick={() => navigate("/")}
          >
            Back to budgets
          </Button>
        </Stack>
      </Box>
    );
  }

  const config = entry.config;
  const transactions = entry.transactions;

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

  const {
    budget,
    dailyBudget,
    events,
    totalBalance,
    balanceToday,
    totalSpent,
  } = useBudget(budgetInput);

  const enrichedEvents = events.map((ev) => ({
    ...ev,
    transactions: transactions.filter(
      (tx) => tx.date === format(ev.date, "yyyy-MM-dd"),
    ),
  }));

  return (
    <Box minH="100vh" bg="bg" pt={4} pb={20}>
      <Container maxW="900px">
        <Stack gap={10}>
          {/* ── Breadcrumb + Header ── */}
          <Stack gap={3}>
            <Flex align="center" gap={2} wrap="wrap">
              <Button
                size="xs"
                variant="ghost"
                borderRadius="lg"
                color="fg.muted"
                onClick={() => navigate("/")}
                px={2}
              >
                <ArrowLeft size={13} />
                All budgets
              </Button>
              <ChevronRight size={12} color="var(--chakra-colors-fg-subtle)" />
              <Flex align="center" gap={1.5}>
                <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
                  {entry.meta.name}
                </Text>
              </Flex>
            </Flex>

            <Flex align="center" gap={2} wrap="wrap">
              <Badge
                colorPalette="green"
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
              <Box flex="1">
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
              </Box>
              <Flex align="end" gap={0}>
                <Box alignSelf="end" lineHeight="2">
                  <MethodDrawer />
                </Box>
                <ColorModeToggle />
              </Flex>
            </Flex>

            <Flex justify="space-between" align="flex-start" gap={4}>
              <Flex align="center" gap={3}>
                <Heading
                  size="4xl"
                  fontWeight="black"
                  letterSpacing="-0.04em"
                  color="fg"
                  lineHeight="1"
                >
                  {entry.meta.name}{" "}
                  <Box as="span" color="fg.muted" fontWeight="light">
                    overview
                  </Box>
                </Heading>
              </Flex>
              <Button
                size="sm"
                variant={showConfig ? "solid" : "outline"}
                colorPalette={showConfig ? "green" : "gray"}
                borderRadius="xl"
                flexShrink={0}
                mt={1}
                onClick={() => setShowConfig((p) => !p)}
              >
                {showConfig ? <X size={14} /> : <Settings size={14} />}
                {showConfig ? "Close" : "Configure"}
              </Button>
            </Flex>
          </Stack>

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
                  colorPalette="green"
                  variant="subtle"
                  borderRadius="lg"
                  onClick={() => setShowForm((p) => !p)}
                >
                  {showForm ? <X size={12} /> : <Plus size={12} />}
                  {showForm ? "Cancel" : "Add"}
                </Button>
              </Flex>
            </Flex>

            {showForm && (
              <TransactionForm
                onSave={handleSaveTx}
                onCancel={() => setShowForm(false)}
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
                <Stack gap={3} display={{ base: "flex", md: "none" }}>
                  {enrichedEvents.map((ev, idx) => (
                    <EventCard
                      key={idx}
                      {...ev}
                      onEdit={handleSaveTx}
                      onDelete={handleDelete}
                      onQuickSave={handleSaveTx}
                    />
                  ))}
                </Stack>
                <Box
                  display={{ base: "none", md: "block" }}
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="2xl"
                  overflow="hidden"
                >
                  <Grid templateColumns={TABLE_COLUMNS}>
                    {TABLE_HEADERS.map((h, i) => (
                      <GridItem
                        key={h}
                        px={i === 0 ? 5 : 0}
                        pr={i === TABLE_HEADERS.length - 1 ? 5 : 0}
                        py={3}
                        bg="bg.muted"
                        borderBottomWidth="1px"
                        borderColor="border.subtle"
                      >
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          letterSpacing="widest"
                          textTransform="uppercase"
                          color="fg.subtle"
                        >
                          {h}
                        </Text>
                      </GridItem>
                    ))}
                    {enrichedEvents.map((ev, idx) => (
                      <EventRow
                        key={idx}
                        {...ev}
                        isLast={idx === enrichedEvents.length - 1}
                        onEdit={handleSaveTx}
                        onDelete={handleDelete}
                      />
                    ))}
                    <GridItem
                      colSpan={6}
                      px={5}
                      py={3}
                      bg="bg.muted"
                      borderTopWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Flex justify="space-between" align="center">
                        <Text fontSize="xs" color="fg.subtle">
                          {events.length} day{events.length !== 1 ? "s" : ""}{" "}
                          tracked
                        </Text>
                        <Text fontSize="xs" color="fg.subtle">
                          {transactions.length} transaction
                          {transactions.length !== 1 ? "s" : ""}
                        </Text>
                      </Flex>
                    </GridItem>
                  </Grid>
                </Box>
              </>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
