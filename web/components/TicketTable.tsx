"use client";

import {
  Box,
  Flex,
  HStack,
  Text,
  Badge,
  Icon,
  Button,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  InputGroup,
  InputLeftElement,
  Checkbox,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight, FiInbox, FiSearch, FiClock } from "react-icons/fi";
import { Conversation, INTENT_LABELS } from "@/lib/types";
import { useRef, useState, useEffect, useMemo } from "react";

const ROW_HEIGHT = 33;
const HEADER_HEIGHT = 105; // includes search bar
const PAGINATION_HEIGHT = 40;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: "orange", label: "New" },
  open: { color: "green", label: "Open" },
  escalated: { color: "red", label: "Escalated" },
  resolved: { color: "gray", label: "Solved" },
  "auto-resolved": { color: "teal", label: "Auto-Resolved" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  urgent: { color: "red", label: "Urgent" },
  high: { color: "orange", label: "High" },
  normal: { color: "blue", label: "Normal" },
  low: { color: "gray", label: "Low" },
};

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  currentPage: number;
  searchQuery: string;
  selectedIds: string[];
  fetchedAt?: number; // timestamp when data was last fetched from server
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onSearchChange: (query: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onBulkStatusChange: (ids: string[], status: string) => void;
  onBulkPriorityChange: (ids: string[], priority: string) => void;
  /** When true, hide checkboxes and bulk actions (member role). */
  readOnly?: boolean;
}

export default function TicketTable({
  conversations,
  selectedId,
  currentPage,
  searchQuery,
  selectedIds,
  onPageChange,
  onSelect,
  onSearchChange,
  onSelectionChange,
  onBulkStatusChange,
  onBulkPriorityChange,
  fetchedAt,
  readOnly = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ticketsPerPage, setTicketsPerPage] = useState(20);

  useEffect(() => {
    const calculate = () => {
      if (containerRef.current) {
        const available = containerRef.current.clientHeight - HEADER_HEIGHT - PAGINATION_HEIGHT;
        const count = Math.max(5, Math.floor(available / ROW_HEIGHT));
        setTicketsPerPage(count);
      }
    };
    calculate();
    window.addEventListener("resize", calculate);
    return () => window.removeEventListener("resize", calculate);
  }, []);

  // Filter by search
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        const subject = getSubject(c).toLowerCase();
        return subject.includes(q) || c.id.toLowerCase().includes(q) || (c.department || "").toLowerCase().includes(q);
      })
    : conversations;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ticketsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * ticketsPerPage;
  const pageTickets = filtered.slice(startIdx, startIdx + ticketsPerPage);

  const allPageSelected = pageTickets.length > 0 && pageTickets.every((c) => selectedIds.includes(c.id));

  const handleSelectAll = () => {
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter((id) => !pageTickets.some((c) => c.id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...pageTickets.map((c) => c.id)]);
      onSelectionChange(Array.from(newIds));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Box ref={containerRef} flex={1} display="flex" flexDirection="column" bg="white" overflow="hidden">
      {/* Search + Count Header */}
      <Box px={4} py={2} borderBottom="1px solid" borderColor="gray.200">
        <Flex align="center" justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.500">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
            {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
          </Text>
        </Flex>
        <InputGroup size="sm">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" boxSize={3.5} />
          </InputLeftElement>
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            borderRadius="md"
            fontSize="xs"
            bg="gray.50"
          />
        </InputGroup>
      </Box>

      {/* Bulk Action Bar */}
      {!readOnly && selectedIds.length > 0 && (
        <Flex px={4} py={1.5} bg="blue.50" borderBottom="1px solid" borderColor="blue.100" align="center" gap={3}>
          <Text fontSize="xs" fontWeight="600" color="blue.700">
            {selectedIds.length} selected
          </Text>
          <Menu>
            <MenuButton as={Button} size="xs" variant="ghost" colorScheme="blue">
              Set Status
            </MenuButton>
            <MenuList minW="120px">
              {Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== "new" && key !== "auto-resolved")
                .map(([key, cfg]) => (
                <MenuItem key={key} fontSize="xs" onClick={() => onBulkStatusChange(selectedIds, key)}>
                  {cfg.label}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
          <Menu>
            <MenuButton as={Button} size="xs" variant="ghost" colorScheme="blue">
              Set Priority
            </MenuButton>
            <MenuList minW="120px">
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <MenuItem key={key} fontSize="xs" onClick={() => onBulkPriorityChange(selectedIds, key)}>
                  {cfg.label}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
          <Button size="xs" variant="ghost" color="gray.500" onClick={() => onSelectionChange([])}>
            Clear
          </Button>
        </Flex>
      )}

      {/* Table */}
      <Box flex={1} overflowY="auto" bg="white">
        {pageTickets.length === 0 ? (
          <Flex direction="column" align="center" py={16} color="gray.400">
            <Icon as={FiInbox} boxSize={10} mb={3} />
            <Text fontSize="sm" fontWeight="500">No tickets</Text>
            <Text fontSize="xs" color="gray.400" mt={1}>
              {searchQuery ? "No tickets match your search" : "Tickets will appear here when users start conversations"}
            </Text>
          </Flex>
        ) : (
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                {!readOnly && (
                  <Th py={2} px={3} w="32px">
                    <Checkbox
                      size="sm"
                      isChecked={allPageSelected}
                      onChange={handleSelectAll}
                      colorScheme="blue"
                    />
                  </Th>
                )}
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="80px">
                  Status
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="110px" title="SLA Timer">
                  <HStack spacing={1}>
                    <Icon as={FiClock} boxSize={3} />
                    <Text fontSize="11px">SLA</Text>
                  </HStack>
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3}>
                  Subject
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="130px">
                  Requester
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="140px">
                  Intent
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="120px">
                  Department
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="120px">
                  Assignee
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="70px">
                  Priority
                </Th>
                <Th fontSize="11px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider" py={2} px={3} w="90px" textAlign="right">
                  Requested
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageTickets.map((conv) => {
                const cfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.open;
                const isSelected = conv.id === selectedId;
                const isChecked = selectedIds.includes(conv.id);
                const priority = conv.priority || "normal";
                const pCfg = PRIORITY_CONFIG[priority];
                return (
                  <Tr
                    key={conv.id}
                    cursor="pointer"
                    bg={isChecked ? "blue.50" : isSelected ? "blue.50" : "white"}
                    _hover={{ bg: isSelected ? "blue.50" : "gray.50" }}
                    onClick={() => onSelect(conv.id)}
                    transition="background 0.1s"
                    borderLeft="3px solid"
                    borderLeftColor={isSelected ? "blue.500" : "transparent"}
                  >
                    {!readOnly && (
                      <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          size="sm"
                          isChecked={isChecked}
                          onChange={() => handleSelectOne(conv.id)}
                          colorScheme="blue"
                        />
                      </Td>
                    )}
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Badge
                        colorScheme={cfg.color}
                        fontSize="11px"
                        fontWeight="500"
                        textTransform="capitalize"
                        px={2}
                        py={0}
                        borderRadius="sm"
                      >
                        {cfg.label}
                      </Badge>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <SlaTimer
                        status={conv.slaStatus || "ok"}
                        remainingMs={conv.slaRemainingMs ?? null}
                        isResolved={conv.status === "resolved"}
                        fetchedAt={fetchedAt ?? Date.now()}
                      />
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Text fontSize="13px" fontWeight="400" color="gray.800" noOfLines={1}>
                        {getSubject(conv)}
                      </Text>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Text fontSize="12px" color="gray.600" noOfLines={1}>
                        {conv.sessionId || "—"}
                      </Text>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Text fontSize="12px" color="gray.500" noOfLines={1}>
                        {conv.intent ? INTENT_LABELS[conv.intent] || conv.intent : "—"}
                      </Text>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Text fontSize="12px" color="gray.500" noOfLines={1}>
                        {conv.department || "—"}
                      </Text>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      <Text fontSize="12px" color="gray.500" noOfLines={1}>
                        {conv.assignedTo || "—"}
                      </Text>
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100">
                      {priority !== "normal" && (
                        <Badge
                          colorScheme={pCfg.color}
                          fontSize="10px"
                          fontWeight="500"
                          px={1.5}
                          py={0}
                          borderRadius="sm"
                        >
                          {pCfg.label}
                        </Badge>
                      )}
                    </Td>
                    <Td py={1} px={3} borderBottom="1px solid" borderColor="gray.100" textAlign="right">
                      <Text fontSize="12px" color="gray.400">
                        {formatTime(conv.updatedAt)}
                      </Text>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex
          px={4}
          py={2}
          bg="white"
          borderTop="1px solid"
          borderColor="gray.200"
          align="center"
          justify="space-between"
        >
          <Text fontSize="xs" color="gray.500">
            {startIdx + 1}–{Math.min(startIdx + ticketsPerPage, filtered.length)} of {filtered.length}
          </Text>
          <HStack spacing={1}>
            <IconButton
              aria-label="Previous page"
              icon={<Icon as={FiChevronLeft} />}
              size="xs"
              variant="ghost"
              isDisabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <Text key={`e${i}`} fontSize="xs" color="gray.400" px={1}>
                  ...
                </Text>
              ) : (
                <Button
                  key={p}
                  size="xs"
                  variant={p === page ? "solid" : "ghost"}
                  colorScheme={p === page ? "blue" : "gray"}
                  minW="28px"
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <IconButton
              aria-label="Next page"
              icon={<Icon as={FiChevronRight} />}
              size="xs"
              variant="ghost"
              isDisabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </HStack>
        </Flex>
      )}
    </Box>
  );
}

function getSubject(conv: Conversation) {
  const firstUserMsg = conv.messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "No subject";
  const text = firstUserMsg.content;
  return text.length > 70 ? text.slice(0, 70) + "..." : text;
}

// ── Live SLA countdown timer ─────────────────────────────────────────────────

/** Global tick — re-renders all timers every second without per-timer intervals. */
function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
}

function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? "-" : "";
  const totalSec = Math.floor(abs / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${sign}${d}d ${h}h`;
  if (h > 0) return `${sign}${h}h ${m}m`;
  return `${sign}${m}m`;
}

function SlaTimer({
  status,
  remainingMs,
  isResolved,
  fetchedAt,
}: {
  status: "ok" | "warning" | "breached";
  remainingMs: number | null;
  isResolved: boolean;
  fetchedAt: number;
}) {
  useTick();

  if (isResolved) {
    return (
      <HStack spacing={1.5}>
        <Box w="6px" h="6px" borderRadius="full" bg="gray.300" />
        <Text fontSize="11px" color="gray.400" fontWeight="500">—</Text>
      </HStack>
    );
  }

  if (remainingMs == null) {
    return <Text fontSize="11px" color="gray.400">—</Text>;
  }

  const elapsed = Date.now() - fetchedAt;
  const liveRemaining = remainingMs - elapsed;
  const breached = liveRemaining <= 0;

  // Zendesk-style: red when breached, orange when close, gray/green when fine
  let dotColor: string;
  let textColor: string;
  if (breached) {
    dotColor = "#cc3340"; // zendesk red
    textColor = "#cc3340";
  } else if (status === "warning") {
    dotColor = "#ed961c"; // zendesk orange/amber
    textColor = "#ad5e18";
  } else {
    dotColor = "#038153"; // zendesk green
    textColor = "#49545c"; // zendesk dark gray text
  }

  return (
    <HStack spacing={1.5}>
      <Box
        w="6px"
        h="6px"
        borderRadius="full"
        bg={dotColor}
        flexShrink={0}
      />
      <Text
        fontSize="11px"
        fontWeight="500"
        color={textColor}
        whiteSpace="nowrap"
      >
        {breached ? `${formatCountdown(liveRemaining)} overdue` : formatCountdown(liveRemaining)}
      </Text>
    </HStack>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
