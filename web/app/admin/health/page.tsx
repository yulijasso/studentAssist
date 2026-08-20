/**
 * System Health page — live operational status for the platform.
 *
 * Surfaces the `admin.systemHealth` check: core services (Postgres, Redis) and
 * the status of each integration (LLM, auth, email, web search). This is the
 * first place to look when something "silently" isn't working.
 *
 * Two modes:
 *  - default (fast): presence-only — is a real value configured?
 *  - "Run live checks": probes credentials (LLM /models, SendGrid /scopes) so a
 *    present-but-invalid key shows as Invalid instead of a false green.
 */
"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  SimpleGrid,
  Spinner,
  Icon,
  HStack,
  VStack,
  Badge,
  Button,
} from "@chakra-ui/react";
import {
  FiDatabase,
  FiServer,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiHelpCircle,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";

type IntegrationStatus = "ok" | "invalid" | "unreachable" | "not_configured" | "unknown";
interface Integration {
  key: string;
  label: string;
  required: boolean;
  status: IntegrationStatus;
  verified: boolean;
  detail?: string;
}

export default function AdminHealthPage() {
  const [deep, setDeep] = useState(false);
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } =
    trpc.admin.systemHealth.useQuery(
      { deep },
      { refetchInterval: deep ? false : 20_000 },
    );

  if (isLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  const services = [
    { label: "Database (Postgres)", ok: data?.db ?? false, icon: FiDatabase },
    { label: "Cache (Redis)", ok: data?.redis ?? false, icon: FiServer },
  ];
  const integrations = (data?.integrations ?? []) as Integration[];
  const missingRequired = integrations.filter(
    (i) => i.required && (i.status === "not_configured" || i.status === "invalid" || i.status === "unknown"),
  );
  const showingLive = data?.deep ?? false;

  return (
    <Box p={8} maxW="1000px">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb={8} gap={4} wrap="wrap">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color="gray.800">
            System Health
          </Text>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Live status of core services and integrations
          </Text>
        </Box>
        <VStack align="flex-end" spacing={1}>
          <Button
            size="sm"
            leftIcon={<Icon as={showingLive ? FiShield : FiRefreshCw} boxSize={3.5} />}
            colorScheme={showingLive ? "green" : "blue"}
            variant={showingLive ? "solid" : "outline"}
            isLoading={isFetching}
            loadingText="Checking"
            onClick={() => {
              setDeep(true);
              refetch();
            }}
          >
            {showingLive ? "Re-run live checks" : "Run live checks"}
          </Button>
          <Text fontSize="10px" color="gray.400">
            Updated {formatTimeAgo(dataUpdatedAt)}
            {showingLive ? " · verified credentials" : " · auto-refreshes"}
          </Text>
        </VStack>
      </Flex>

      {/* Critical banner */}
      {missingRequired.length > 0 && (
        <Flex
          bg="red.50"
          border="1px solid"
          borderColor="red.200"
          borderRadius="lg"
          px={5}
          py={4}
          mb={6}
          gap={3}
          align="center"
        >
          <Icon as={FiAlertTriangle} boxSize={5} color="red.500" />
          <Box>
            <Text fontSize="sm" fontWeight="600" color="red.800">
              {missingRequired.length} required integration
              {missingRequired.length !== 1 ? "s" : ""} not healthy
            </Text>
            <Text fontSize="xs" color="red.600">
              {missingRequired.map((i) => i.label).join(", ")} — the platform may
              not function correctly until these are resolved.
            </Text>
          </Box>
        </Flex>
      )}

      {/* Core services */}
      <Text fontSize="sm" fontWeight="600" color="gray.700" mb={3}>
        Core Services
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={8}>
        {services.map((s) => (
          <Flex
            key={s.label}
            bg="white"
            border="1px solid"
            borderColor={s.ok ? "gray.200" : "red.200"}
            borderRadius="lg"
            p={5}
            align="center"
            justify="space-between"
          >
            <HStack spacing={3}>
              <Flex
                w={9}
                h={9}
                bg={s.ok ? "green.50" : "red.50"}
                borderRadius="lg"
                align="center"
                justify="center"
              >
                <Icon as={s.icon} boxSize={4} color={s.ok ? "green.500" : "red.500"} />
              </Flex>
              <Text fontSize="sm" fontWeight="500" color="gray.700">
                {s.label}
              </Text>
            </HStack>
            <StatusPill
              scheme={s.ok ? "green" : "red"}
              icon={s.ok ? FiCheckCircle : FiXCircle}
              text={s.ok ? "Online" : "Unreachable"}
            />
          </Flex>
        ))}
      </SimpleGrid>

      {/* Integrations */}
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontSize="sm" fontWeight="600" color="gray.700">
          Integrations
        </Text>
        {!showingLive && (
          <Text fontSize="11px" color="gray.400">
            Presence-only — run live checks to validate credentials
          </Text>
        )}
      </Flex>
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        overflow="hidden"
      >
        <VStack align="stretch" spacing={0}>
          {integrations.map((i) => {
            const v = statusView(i);
            return (
              <Flex
                key={i.key}
                px={5}
                py={4}
                align="center"
                justify="space-between"
                borderBottom="1px solid"
                borderColor="gray.50"
                _last={{ borderBottom: "none" }}
                gap={3}
              >
                <HStack spacing={3} minW={0}>
                  <Text fontSize="sm" fontWeight="500" color="gray.700">
                    {i.label}
                  </Text>
                  <Badge
                    colorScheme={i.required ? "purple" : "gray"}
                    variant="subtle"
                    fontSize="10px"
                  >
                    {i.required ? "Required" : "Optional"}
                  </Badge>
                  {i.detail && (
                    <Text fontSize="11px" color="gray.400" isTruncated>
                      {i.detail}
                    </Text>
                  )}
                </HStack>
                <StatusPill scheme={v.scheme} icon={v.icon} text={v.text} />
              </Flex>
            );
          })}
        </VStack>
      </Box>

      <Text fontSize="11px" color="gray.400" mt={4}>
        {showingLive
          ? "Live checks validate that the credential is accepted by the provider. A valid email key can still be rejected at send time if the sender address isn't verified."
          : "Presence-only means a real (non-placeholder) value exists in the environment. It does not guarantee the credential is valid — run live checks to confirm."}
      </Text>
    </Box>
  );
}

/* ─── Status → display mapping ─── */

function statusView(i: Integration): {
  scheme: string;
  icon: React.ElementType;
  text: string;
} {
  switch (i.status) {
    case "ok":
      return i.verified
        ? { scheme: "green", icon: FiCheckCircle, text: "Verified" }
        : { scheme: "blue", icon: FiCheckCircle, text: "Configured" };
    case "invalid":
      return { scheme: "red", icon: FiXCircle, text: "Invalid key" };
    case "unreachable":
      return { scheme: "orange", icon: FiAlertTriangle, text: "Unreachable" };
    case "unknown":
      return { scheme: "orange", icon: FiHelpCircle, text: "Unknown" };
    case "not_configured":
    default:
      return i.required
        ? { scheme: "red", icon: FiXCircle, text: "Missing" }
        : { scheme: "gray", icon: FiXCircle, text: "Not set" };
  }
}

/* ─── Sub-components ─── */

/** Colored status pill with an icon. */
function StatusPill({
  scheme,
  icon,
  text,
}: {
  scheme: string;
  icon: React.ElementType;
  text: string;
}) {
  return (
    <HStack
      spacing={1.5}
      bg={`${scheme}.50`}
      borderRadius="full"
      px={3}
      py={1}
      flexShrink={0}
    >
      <Icon as={icon} boxSize={3.5} color={`${scheme}.500`} />
      <Text fontSize="11px" fontWeight="600" color={`${scheme}.600`}>
        {text}
      </Text>
    </HStack>
  );
}

/* ─── Helpers ─── */

/** Format a timestamp as a short relative time string. */
function formatTimeAgo(ts: number): string {
  if (!ts) return "just now";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
