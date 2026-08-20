/**
 * Audit Log — immutable record of platform governance actions, with filtering.
 *
 * Filters (date range, action, institution, actor, search, destructive-only) run
 * client-side over the fetched entries. Rows expand to show stored metadata, and
 * the current (filtered) view can be exported to CSV.
 */
"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  VStack,
  Icon,
  Input,
  Select,
  Switch,
  Button,
  FormLabel,
  Code,
} from "@chakra-ui/react";
import { FiShield, FiDownload, FiChevronRight, FiChevronDown, FiArrowRight, FiX } from "react-icons/fi";
import { trpc } from "@/lib/trpc";

type AuditEntry = {
  id: string;
  action: string;
  actorLabel: string | null;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  tenantId: string | null;
  scope: string | null;
  metadata: unknown;
  createdAt: string | Date;
};

const ACTION_META: Record<string, { label: string; scheme: string }> = {
  "institution.create": { label: "Created institution", scheme: "green" },
  "institution.update": { label: "Updated institution", scheme: "blue" },
  "institution.suspend": { label: "Suspended institution", scheme: "orange" },
  "institution.activate": { label: "Activated institution", scheme: "green" },
  "institution.delete": { label: "Deleted institution", scheme: "red" },
  "role.assign": { label: "Assigned role", scheme: "purple" },
  "invitation.create": { label: "Sent invitation", scheme: "teal" },
  "invitation.revoke": { label: "Revoked invitation", scheme: "orange" },
  "member.update": { label: "Updated member", scheme: "blue" },
  "member.remove": { label: "Removed member", scheme: "red" },
  "user.deactivate": { label: "Deactivated user", scheme: "orange" },
  "user.reactivate": { label: "Reactivated user", scheme: "green" },
  "user.delete": { label: "Deleted user", scheme: "red" },
};

const DESTRUCTIVE = new Set([
  "institution.delete",
  "institution.suspend",
  "member.remove",
  "user.deactivate",
  "user.delete",
]);

const CATEGORIES = [
  { value: "all", label: "All actions" },
  { value: "institution", label: "Institutions" },
  { value: "user", label: "Users" },
  { value: "member", label: "Members" },
  { value: "role", label: "Roles" },
  { value: "invitation", label: "Invitations" },
];

const SCOPES = [
  { value: "all", label: "All sources" },
  { value: "platform", label: "Tech admin" },
  { value: "tenant", label: "Institution" },
];

const RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom…" },
];

export default function AdminAuditPage() {
  const { data: entriesRaw, isLoading } = trpc.admin.auditLog.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: institutions } = trpc.admin.listInstitutions.useQuery();

  const entries = (entriesRaw ?? []) as AuditEntry[];

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [institutionId, setInstitutionId] = useState("all");
  const [actor, setActor] = useState("all");
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [destructiveOnly, setDestructiveOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tenantName = (id: string | null) =>
    id ? institutions?.find((i) => i.id === id)?.name ?? "—" : "—";

  // Distinct actors for the actor dropdown.
  const actors = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actorLabel).filter(Boolean))) as string[],
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const fromTs = customFrom ? new Date(customFrom).getTime() : null;
    const toTs = customTo ? new Date(customTo).getTime() + 86_400_000 : null; // inclusive end-of-day

    return entries.filter((e) => {
      // Search
      if (q) {
        const hay = `${e.actorLabel ?? ""} ${e.targetLabel ?? ""} ${e.targetId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Scope (tech-admin vs institution-admin action)
      if (scope !== "all" && e.scope !== scope) return false;
      // Category (action prefix)
      if (category !== "all" && !e.action.startsWith(`${category}.`)) return false;
      // Institution
      if (institutionId !== "all" && e.tenantId !== institutionId) return false;
      // Actor
      if (actor !== "all" && e.actorLabel !== actor) return false;
      // Destructive only
      if (destructiveOnly && !DESTRUCTIVE.has(e.action)) return false;
      // Date range
      const ts = new Date(e.createdAt).getTime();
      if (range === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (ts < start.getTime()) return false;
      } else if (range === "7d") {
        if (ts < now - 7 * 86_400_000) return false;
      } else if (range === "30d") {
        if (ts < now - 30 * 86_400_000) return false;
      } else if (range === "custom") {
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
      }
      return true;
    });
  }, [entries, search, scope, category, institutionId, actor, destructiveOnly, range, customFrom, customTo]);

  function exportCsv() {
    const header = ["Date", "Actor", "Action", "Target Type", "Target", "Institution", "Metadata"];
    const rows = filtered.map((e) => [
      formatDate(e.createdAt),
      e.actorLabel ?? "",
      e.action,
      e.targetType,
      e.targetLabel ?? e.targetId ?? "",
      tenantName(e.tenantId),
      e.metadata ? JSON.stringify(e.metadata) : "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setSearch("");
    setScope("all");
    setCategory("all");
    setInstitutionId("all");
    setActor("all");
    setRange("all");
    setCustomFrom("");
    setCustomTo("");
    setDestructiveOnly(false);
  }

  const hasFilters =
    search || scope !== "all" || category !== "all" || institutionId !== "all" ||
    actor !== "all" || range !== "all" || destructiveOnly;

  if (isLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8} maxW="1200px">
      <Flex justify="space-between" align="flex-start" mb={6}>
        <Box>
          <HStack spacing={2} mb={1}>
            <Icon as={FiShield} boxSize={5} color="purple.500" />
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Audit Log
            </Text>
          </HStack>
          <Text fontSize="sm" color="gray.500">
            Who created, changed, or removed institutions, roles, members, and users
          </Text>
        </Box>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon as={FiDownload} boxSize={3.5} />}
          onClick={exportCsv}
          isDisabled={filtered.length === 0}
        >
          Export CSV
        </Button>
      </Flex>

      {/* Filter bar — minimal, borderless */}
      <Box mb={4}>
        <Flex gap={3} wrap="wrap" align="center">
          <Input
            size="sm"
            variant="flushed"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxW="180px"
          />
          <Select size="sm" variant="flushed" value={scope} onChange={(e) => setScope(e.target.value)} maxW="120px">
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Select size="sm" variant="flushed" value={category} onChange={(e) => setCategory(e.target.value)} maxW="130px">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Select size="sm" variant="flushed" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} maxW="160px">
            <option value="all">All institutions</option>
            {institutions?.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </Select>
          <Select size="sm" variant="flushed" value={actor} onChange={(e) => setActor(e.target.value)} maxW="140px">
            <option value="all">All actors</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Select size="sm" variant="flushed" value={range} onChange={(e) => setRange(e.target.value)} maxW="130px">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          {range === "custom" && (
            <HStack spacing={1}>
              <Input size="sm" variant="flushed" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} maxW="140px" />
              <Text fontSize="xs" color="gray.400">to</Text>
              <Input size="sm" variant="flushed" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} maxW="140px" />
            </HStack>
          )}
          <HStack spacing={2}>
            <Switch size="sm" colorScheme="red" isChecked={destructiveOnly} onChange={(e) => setDestructiveOnly(e.target.checked)} />
            <FormLabel
              fontSize="xs"
              mb={0}
              fontWeight={destructiveOnly ? "600" : "400"}
              color={destructiveOnly ? "red.500" : "gray.500"}
              transition="color 0.15s"
            >
              Destructive only
            </FormLabel>
          </HStack>
        </Flex>
        <Flex mt={3} align="center" justify="space-between">
          <Text fontSize="11px" color="gray.400">
            {filtered.length} of {entries.length} entries
          </Text>
          {hasFilters && (
            <Button
              size="xs"
              variant="outline"
              colorScheme="blue"
              leftIcon={<Icon as={FiX} boxSize={3} />}
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          )}
        </Flex>
      </Box>

      {/* Table */}
      <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" overflow="hidden">
        {filtered.length > 0 ? (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th fontSize="10px" py={3} w="24px" />
                  <Th fontSize="10px" py={3}>Date</Th>
                  <Th fontSize="10px" py={3}>When</Th>
                  <Th fontSize="10px" py={3}>Actor</Th>
                  <Th fontSize="10px" py={3}>Action</Th>
                  <Th fontSize="10px" py={3}>Target</Th>
                  <Th fontSize="10px" py={3}>Institution</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((e) => {
                  const meta = ACTION_META[e.action] ?? { label: e.action, scheme: "gray" };
                  const isOpen = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <Tr
                        _hover={{ bg: "gray.50" }}
                        cursor="pointer"
                        onClick={() => setExpandedId(isOpen ? null : e.id)}
                      >
                        <Td py={0} color="gray.400">
                          <Icon as={isOpen ? FiChevronDown : FiChevronRight} boxSize={3.5} />
                        </Td>
                        <Td py={0} fontSize="xs" color="gray.700" fontFamily="mono" whiteSpace="nowrap">
                          {formatDate(e.createdAt)}
                        </Td>
                        <Td py={0} fontSize="xs" color="gray.500" whiteSpace="nowrap">
                          {formatTimeAgo(e.createdAt)}
                        </Td>
                        <Td py={0} fontSize="xs" fontWeight="500" color="gray.700">
                          {e.actorLabel ?? "—"}
                        </Td>
                        <Td py={0}>
                          <Badge fontSize="10px" colorScheme={meta.scheme}>{meta.label}</Badge>
                        </Td>
                        <Td py={0} fontSize="xs" color="gray.700">
                          {e.targetLabel ?? e.targetId ?? "—"}
                        </Td>
                        <Td py={0} fontSize="xs" color="gray.500">
                          {tenantName(e.tenantId)}
                        </Td>
                      </Tr>
                      {isOpen && (
                        <Tr bg="gray.50">
                          <Td />
                          <Td colSpan={6} py={3}>
                            <HStack spacing={6} align="flex-start" fontSize="11px" color="gray.600" flexWrap="wrap">
                              <Box>
                                <Text color="gray.400">Target type</Text>
                                <Text fontWeight="500">{e.targetType}</Text>
                              </Box>
                              <Box>
                                <Text color="gray.400">Target id</Text>
                                <Text fontFamily="mono">{e.targetId ?? "—"}</Text>
                              </Box>
                              <Box flex={1} minW="200px">
                                <Text color="gray.400" mb={1}>Details</Text>
                                <MetadataView metadata={e.metadata} />
                              </Box>
                            </HStack>
                          </Td>
                        </Tr>
                      )}
                    </Fragment>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        ) : (
          <Flex p={10} justify="center">
            <Text fontSize="sm" color="gray.400">
              {entries.length === 0
                ? "No audit entries yet. Governance actions will appear here."
                : "No entries match the current filters."}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

/** Renders metadata as a readable list; diff-shaped values show "from → to". */
function MetadataView({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object" || Object.keys(metadata).length === 0) {
    return <Text fontSize="11px" color="gray.400">No details</Text>;
  }
  const entries = Object.entries(metadata as Record<string, unknown>);
  return (
    <VStack align="stretch" spacing={1}>
      {entries.map(([key, value]) => {
        const isDiff =
          value != null && typeof value === "object" && "from" in value && "to" in value;
        return (
          <HStack key={key} spacing={2} fontSize="11px" align="center">
            <Text color="gray.500" minW="110px">{key}</Text>
            {isDiff ? (
              <HStack spacing={1.5}>
                <Code fontSize="10px">{fmtVal((value as { from: unknown }).from)}</Code>
                <Icon as={FiArrowRight} boxSize={3} color="gray.400" />
                <Code fontSize="10px" colorScheme="blue">{fmtVal((value as { to: unknown }).to)}</Code>
              </HStack>
            ) : (
              <Code fontSize="10px">{fmtVal(value)}</Code>
            )}
          </HStack>
        );
      })}
    </VStack>
  );
}

/** Formats a metadata value for display. */
function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Format a timestamp as MM/DD/YY. */
function formatDate(date: string | Date): string {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** Format a timestamp as a short relative time string. */
function formatTimeAgo(date: string | Date): string {
  const then = new Date(date);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}
