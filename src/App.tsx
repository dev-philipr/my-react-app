import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Provider } from "./components/ui/provider";
import { customAlphabet } from "nanoid";
import { createSpace } from "./api";
import { Box, Button, Container, Flex, Input, Text } from "@chakra-ui/react";
import { Lock } from "lucide-react";
import { useEmail } from "./hooks/use-email";

const queryClient = new QueryClient();
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

import BudgetDetail from "./budget-details";
import BudgetList from "./budget-list";
import { useBudgets } from "./hooks/use-budgets";

// ─── Access prompt ────────────────────────────────────────────────────────────

function AccessPrompt({
  projectSlug,
  onSubmit,
}: {
  projectSlug: string;
  onSubmit: (email: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <Box minH="100vh" bg="bg" display="flex" alignItems="center" justifyContent="center">
      <Container maxW="400px" px={6}>
        <Flex direction="column" align="center" gap={6}>
          <Box
            w={14}
            h={14}
            borderRadius="2xl"
            bg="orange.subtle"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Lock size={24} color="var(--chakra-colors-orange-fg)" />
          </Box>

          <Box textAlign="center">
            <Text
              fontSize="2xl"
              fontWeight="black"
              letterSpacing="-0.03em"
              color="fg"
              mb={1}
            >
              Private space
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Enter your email to access{" "}
              <Box as="span" fontFamily="mono" color="fg">
                /{projectSlug}
              </Box>
            </Text>
          </Box>

          <Flex
            direction="column"
            gap={3}
            w="100%"
            as="form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = value.trim().toLowerCase();
              if (trimmed) onSubmit(trimmed);
            }}
          >
            <Input
              type="email"
              placeholder="your@email.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              size="md"
              borderRadius="xl"
              autoFocus
            />
            <Button
              type="submit"
              colorPalette="orange"
              borderRadius="xl"
              disabled={!value.trim()}
            >
              Continue
            </Button>
          </Flex>

          <Text fontSize="2xs" color="fg.subtle" textAlign="center">
            Your email is stored locally on this device.
          </Text>
        </Flex>
      </Container>
    </Box>
  );
}

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
  const { setEmail } = useEmail();
  const qc = useQueryClient();
  const budgets = useBudgets(projectSlug!);

  if (budgets.accessDenied) {
    return (
      <AccessPrompt
        projectSlug={projectSlug!}
        onSubmit={(email) => {
          setEmail(email);
          qc.invalidateQueries({ queryKey: ["space", projectSlug] });
        }}
      />
    );
  }

  return <BudgetList projectSlug={projectSlug!} {...budgets} />;
}

function BudgetDetailRoute() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const { setEmail } = useEmail();
  const qc = useQueryClient();
  const budgets = useBudgets(projectSlug!);

  if (budgets.accessDenied) {
    return (
      <AccessPrompt
        projectSlug={projectSlug!}
        onSubmit={(email) => {
          setEmail(email);
          qc.invalidateQueries({ queryKey: ["space", projectSlug] });
        }}
      />
    );
  }

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
