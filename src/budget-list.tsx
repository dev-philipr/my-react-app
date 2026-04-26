import {
  Box,
  Badge,
  Button,
  Container,
  Flex,
  Grid,
  IconButton,
  Input,
  InputGroup,
  Field,
  Stack,
  Text,
  Icon,
} from "@chakra-ui/react";
import { parseISO, differenceInDays, format } from "date-fns";
import {
  Moon,
  Sun,
  X,
  Check,
  Trash2,
  Calendar,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useColorMode } from "./components/ui/color-mode";
import type {
  BudgetMeta,
  BudgetEntry,
  BudgetConfig,
} from "./hooks/use-budgets";
import { MethodDrawer } from "./budget-details";
import { useBudget } from "./hooks/use-budget";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetListProps {
  projectSlug: string;
  index: BudgetMeta[];
  getBudgetEntry: (id: string) => BudgetEntry | null;
  createBudget: (name: string, config: BudgetConfig) => string;
  deleteBudget: (id: string) => void;
}

// ─── Color mode toggle ────────────────────────────────────────────────────────

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <IconButton
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

// ─── Derive summary stats from entry ─────────────────────────────────────────

function deriveSummary(entry: BudgetEntry) {
  let status: "active" | "upcoming" | "ended" = "active";
  try {
    const from = parseISO(entry.config.rangeFrom);
    const to = parseISO(entry.config.rangeTo);
    const now = new Date();
    if (now < from) status = "upcoming";
    else if (now > to) status = "ended";
  } catch {}

  let days = 0;
  try {
    days =
      differenceInDays(
        parseISO(entry.config.rangeTo),
        parseISO(entry.config.rangeFrom),
      ) + 1;
  } catch {}

  return { status, days };
}

// ─── Compact burn bar ─────────────────────────────────────────────────────────

function BurnBar({ pct, color }: { pct: number; color: string }) {
  const barColor =
    pct > 85 ? "red.400" : pct > 60 ? "orange.400" : `${color}.400`;
  return (
    <Box>
      <Box h="3px" bg="bg.muted" borderRadius="full" overflow="hidden">
        <Box
          h="100%"
          w={`${pct}%`}
          bg={barColor}
          borderRadius="full"
          transition="width 0.8s cubic-bezier(.16,1,.3,1)"
        />
      </Box>
      <Flex justify="space-between" mt={1}>
        <Text fontSize="2xs" color="fg.subtle">
          {pct.toFixed(0)}% spent
        </Text>
      </Flex>
    </Box>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "upcoming" | "ended" }) {
  const map = {
    active: { palette: "green", label: "Active" },
    upcoming: { palette: "blue", label: "Upcoming" },
    ended: { palette: "gray", label: "Ended" },
  };
  const { palette, label } = map[status];
  return (
    <Badge
      colorPalette={palette}
      variant="subtle"
      borderRadius="full"
      px={2}
      py={0.5}
      fontSize="2xs"
      fontWeight="semibold"
      letterSpacing="wider"
      textTransform="uppercase"
    >
      {label}
    </Badge>
  );
}

// ─── New Budget Modal ─────────────────────────────────────────────────────────

interface NewBudgetFormProps {
  onSave: (name: string, config: BudgetConfig) => void;
  onCancel: () => void;
}

const EMPTY_CONFIG: BudgetConfig = {
  rangeFrom: "",
  rangeTo: "",
  budget: 0,
  dailyBudget: 0,
};

function NewBudgetForm({ onSave, onCancel }: NewBudgetFormProps) {
  const [name, setName] = useState("");
  const [config, setConfig] = useState<BudgetConfig>(EMPTY_CONFIG);

  function set<K extends keyof BudgetConfig>(key: K, val: BudgetConfig[K]) {
    setConfig((p) => ({ ...p, [key]: val }));
  }

  const isValid =
    name.trim() !== "" &&
    config.rangeFrom !== "" &&
    config.rangeTo !== "" &&
    config.rangeFrom <= config.rangeTo &&
    config.budget >= 0;

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={50}
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
    >
      {/* Backdrop */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.700"
        backdropFilter="blur(4px)"
        onClick={onCancel}
      />

      {/* Modal */}
      <Box
        position="relative"
        zIndex={1}
        bg="bg"
        borderWidth="1px"
        borderColor="border.emphasized"
        borderRadius="3xl"
        p={8}
        w="100%"
        maxW="560px"
        shadow="2xl"
      >
        {/* Header */}
        <Flex justify="space-between" align="center" mb={7}>
          <Box>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.muted"
              mb={1}
            >
              New budget
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="black"
              letterSpacing="-0.03em"
              color="fg"
              lineHeight="1"
            >
              Create a budget
            </Text>
          </Box>
          <IconButton
            size="sm"
            variant="ghost"
            borderRadius="xl"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </IconButton>
        </Flex>

        {/* Name */}
        <Field.Root mb={6}>
          <Field.Label
            fontSize="xs"
            color="fg.muted"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Name
          </Field.Label>
          <Input
            size="sm"
            borderRadius="lg"
            placeholder="e.g. Tokyo Trip, March Budget…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && isValid && onSave(name, config)
            }
          />
        </Field.Root>

        {/* Date range */}
        <Grid templateColumns="1fr 1fr" gap={4} mb={6}>
          <Field.Root>
            <Field.Label
              fontSize="xs"
              color="fg.muted"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              Start date
            </Field.Label>
            <Input
              type="date"
              size="sm"
              borderRadius="lg"
              value={config.rangeFrom}
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
              End date
            </Field.Label>
            <Input
              type="date"
              size="sm"
              borderRadius="lg"
              value={config.rangeTo}
              onChange={(e) => set("rangeTo", e.target.value)}
            />
          </Field.Root>
        </Grid>

        {/* Budget amounts */}
        <Grid templateColumns="1fr 1fr" gap={4} mb={8}>
          <Field.Root>
            <Field.Label
              fontSize="xs"
              color="fg.muted"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              Total budget
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
                value={config.budget || ""}
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
              Daily budget
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
                value={config.dailyBudget || ""}
                onChange={(e) =>
                  set("dailyBudget", parseFloat(e.target.value) || 0)
                }
              />
            </InputGroup>
          </Field.Root>
        </Grid>

        {/* Actions */}
        <Flex gap={3} justify="flex-end">
          <Button
            size="sm"
            variant="ghost"
            borderRadius="lg"
            onClick={onCancel}
          >
            <X size={14} /> Cancel
          </Button>
          <Button
            size="sm"
            colorPalette="green"
            borderRadius="lg"
            disabled={!isValid}
            onClick={() => onSave(name, config)}
          >
            <Check size={14} /> Create budget
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

interface BudgetCardProps {
  meta: BudgetMeta;
  entry: BudgetEntry | null;
  onOpen: () => void;
  onDelete: () => void;
}

function BudgetCard({ meta, entry, onOpen, onDelete }: BudgetCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { totalBalance, totalSpent, budget } = useBudget(
    entry
      ? {
          config: {
            range: {
              from: parseISO(entry.config.rangeFrom),
              to: parseISO(entry.config.rangeTo),
            },
            budget: entry.config.budget,
            dailyBudget: entry.config.dailyBudget,
          },
          transactions: entry.transactions.map((tx) => ({
            credit: tx.credit,
            debit: tx.debit,
            date: parseISO(tx.date),
          })),
        }
      : {
          config: {
            range: { from: new Date(), to: new Date() },
            budget: 0,
            dailyBudget: 0,
          },
          transactions: [],
        },
  );

  if (!entry) return null;

  const { status, days } = deriveSummary(entry);
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const isPositive = totalBalance >= 0;

  const dateRange = (() => {
    try {
      return `${format(parseISO(entry.config.rangeFrom), "MMM d")} – ${format(parseISO(entry.config.rangeTo), "MMM d, yyyy")}`;
    } catch {
      return "—";
    }
  })();

  return (
    <Box
      position="relative"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      overflow="hidden"
      cursor="pointer"
      onClick={onOpen}
      transition="all 0.2s cubic-bezier(.16,1,.3,1)"
      _hover={{
        borderColor: `${meta.color}.400`,
        shadow: "lg",
        transform: "translateY(-2px)",
      }}
      role="group"
    >
      {/* Top accent stripe */}
      <Box h="3px" bg={`${meta.color}.400`} />

      <Box p={5}>
        {/* Header row */}
        <Flex justify="space-between" align="flex-start" mb={4}>
          <Flex align="center" gap={3}>
            <Box>
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="fg"
                letterSpacing="-0.01em"
                lineHeight="1.2"
              >
                {meta.name}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt={0.5}>
                {days} days
              </Text>
            </Box>
          </Flex>
          <Flex align="center" gap={2} onClick={(e) => e.stopPropagation()}>
            <StatusBadge status={status} />
            {confirmDelete ? (
              <Flex gap={1}>
                <IconButton
                  aria-label="Confirm delete"
                  size="xs"
                  colorPalette="red"
                  variant="solid"
                  borderRadius="lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Check size={11} />
                </IconButton>
                <IconButton
                  aria-label="Cancel delete"
                  size="xs"
                  variant="ghost"
                  borderRadius="lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                >
                  <X size={11} />
                </IconButton>
              </Flex>
            ) : (
              <IconButton
                aria-label="Delete budget"
                size="xs"
                variant="ghost"
                colorPalette="red"
                borderRadius="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
              >
                <Icon color="red.500">
                  <Trash2 size={12} />
                </Icon>
              </IconButton>
            )}
          </Flex>
        </Flex>

        {/* Total balance */}
        <Flex align="baseline" gap={1.5} mb={1}>
          <Text
            fontSize="2xl"
            fontWeight="black"
            letterSpacing="-0.04em"
            color={isPositive ? "green.500" : "red.500"}
          >
            ${Math.abs(totalBalance).toFixed(2)}
          </Text>
          <Text fontSize="xs" color="fg.subtle">
            balance
          </Text>
        </Flex>

        {/* Burn bar */}
        <BurnBar pct={pct} color={meta.color} />

        {/* Footer stats */}
        <Flex mt={4} borderTopWidth="1px" borderColor="border.subtle" pt={4}>
          <Box flex="1">
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
              mb={0.5}
            >
              Budget
            </Text>
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color="fg"
              fontVariantNumeric="tabular-nums"
            >
              ${budget.toFixed(0)}
            </Text>
          </Box>
          <Box flex="1">
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
              mb={0.5}
            >
              Spent
            </Text>
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color={totalSpent > 0 ? "red.500" : "fg.muted"}
              fontVariantNumeric="tabular-nums"
            >
              ${totalSpent.toFixed(0)}
            </Text>
          </Box>
          <Box flex="1">
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
              mb={0.5}
            >
              Txns
            </Text>
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color="fg"
              fontVariantNumeric="tabular-nums"
            >
              {entry.transactions.length}
            </Text>
          </Box>
        </Flex>

        {/* Date range + arrow */}
        <Flex
          justify="space-between"
          align="center"
          mt={3}
          pt={3}
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <Flex align="center" gap={1.5}>
            <Calendar size={11} color="var(--chakra-colors-fg-subtle)" />
            <Text fontSize="xs" color="fg.subtle">
              {dateRange}
            </Text>
          </Flex>
          <Box
            opacity={0}
            _groupHover={{ opacity: 1 }}
            transition="opacity 0.15s, transform 0.15s"
          >
            <ChevronRight size={14} color="var(--chakra-colors-fg-muted)" />
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      py={24}
      gap={6}
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="3xl"
      borderStyle="dashed"
      bg="bg.subtle"
    >
      <Box
        w={16}
        h={16}
        borderRadius="2xl"
        bg="green.subtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Plus size={28} color="var(--chakra-colors-green-fg)" />
      </Box>
      <Box textAlign="center">
        <Text
          fontSize="xl"
          fontWeight="bold"
          color="fg"
          letterSpacing="-0.02em"
          mb={1}
        >
          No budgets yet
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Create your first budget to start tracking
        </Text>
      </Box>
      <Button colorPalette="green" borderRadius="xl" onClick={onCreate}>
        <Plus size={15} /> Create budget
      </Button>
    </Flex>
  );
}

// ─── BudgetList page ──────────────────────────────────────────────────────────

export default function BudgetList({
  projectSlug,
  index,
  getBudgetEntry,
  createBudget,
  deleteBudget,
}: BudgetListProps) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const entries = useMemo(
    () =>
      index
        .map((m) => ({ meta: m, entry: getBudgetEntry(m.id) }))
        .filter(
          ({ meta }) =>
            search.trim() === "" ||
            meta.name.toLowerCase().includes(search.toLowerCase()),
        ),
    [index, getBudgetEntry, search],
  );

  const totalBudgets = index.length;
  const activeBudgets = index.filter((m) => {
    const e = getBudgetEntry(m.id);
    if (!e) return false;
    try {
      const now = new Date();
      return (
        now >= parseISO(e.config.rangeFrom) && now <= parseISO(e.config.rangeTo)
      );
    } catch {
      return false;
    }
  }).length;

  function handleCreate(name: string, config: BudgetConfig) {
    const id = createBudget(name, config);
    setShowCreate(false);
    navigate(`/${projectSlug}/${id}`);
  }

  return (
    <>
      <Box minH="100vh" bg="bg" pt={6} pb={20}>
        <Container maxW="960px">
          <Stack gap={10}>
            {/* ── Header ── */}
            <Flex
              justify="space-between"
              align="flex-start"
              wrap="wrap"
              gap={4}
            >
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  letterSpacing="widest"
                  textTransform="uppercase"
                  color="fg.muted"
                  mb={2}
                >
                  Day Pocket
                </Text>
                <Text
                  fontSize={{ base: "3xl", md: "5xl" }}
                  fontWeight="black"
                  letterSpacing="-0.04em"
                  color="fg"
                  lineHeight="1"
                >
                  My{" "}
                  <Box as="span" color="fg.muted" fontWeight="light">
                    budgets
                  </Box>
                </Text>
              </Box>

              <Flex align="center" gap={2} mt={{ base: 0, md: 2 }}>
                <MethodDrawer />
                <ColorModeToggle />
              </Flex>
            </Flex>

            {/* ── Summary strip ── */}
            {totalBudgets > 0 && (
              <Grid
                templateColumns={{ base: "1fr 1fr", md: "1fr 1fr 1fr" }}
                gap={3}
              >
                {[
                  {
                    label: "Total budgets",
                    value: String(totalBudgets),
                    sub: "created",
                  },
                  {
                    label: "Active now",
                    value: String(activeBudgets),
                    sub: "in progress",
                  },
                ].map(({ label, value, sub }) => (
                  <Box
                    key={label}
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderRadius="2xl"
                    px={5}
                    py={4}
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
                      fontSize="2xl"
                      fontWeight="black"
                      letterSpacing="-0.04em"
                      color="fg"
                    >
                      {value}
                    </Text>
                    <Text fontSize="xs" color="fg.subtle" mt={0.5}>
                      {sub}
                    </Text>
                  </Box>
                ))}
              </Grid>
            )}

            {/* ── Search ── */}
            {totalBudgets > 3 && (
              <InputGroup
                startElement={
                  <Search size={14} color="var(--chakra-colors-fg-subtle)" />
                }
              >
                <Input
                  size="sm"
                  borderRadius="xl"
                  placeholder="Search budgets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            )}

            {/* ── Grid ── */}
            {entries.length === 0 && search === "" ? (
              <EmptyState onCreate={() => setShowCreate(true)} />
            ) : entries.length === 0 ? (
              <Flex justify="center" py={12}>
                <Text color="fg.subtle" fontSize="sm">
                  No budgets match "{search}"
                </Text>
              </Flex>
            ) : (
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "1fr 1fr",
                  lg: "1fr 1fr 1fr",
                }}
                gap={4}
              >
                {entries.map(({ meta, entry }) => (
                  <BudgetCard
                    key={meta.id}
                    meta={meta}
                    entry={entry}
                    onOpen={() => navigate(`/${projectSlug}/${meta.id}`)}
                    onDelete={() => deleteBudget(meta.id)}
                  />
                ))}
                {/* Ghost "add" card */}
                <Box
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderStyle="dashed"
                  borderRadius="2xl"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  minH="200px"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ borderColor: "green.400", bg: "green.subtle" }}
                  onClick={() => setShowCreate(true)}
                >
                  <Flex direction="column" align="center" gap={2}>
                    <Box
                      w={10}
                      h={10}
                      borderRadius="xl"
                      bg="bg.muted"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Plus size={18} color="var(--chakra-colors-fg-subtle)" />
                    </Box>
                    <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
                      New budget
                    </Text>
                  </Flex>
                </Box>
              </Grid>
            )}
          </Stack>
        </Container>
      </Box>

      {showCreate && (
        <NewBudgetForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
