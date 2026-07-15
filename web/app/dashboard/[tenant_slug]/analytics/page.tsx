"use client";

import { useMemo } from "react";
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  Badge,
  Flex,
  Spinner,
} from "@chakra-ui/react";
import {
  FiAlertCircle,
  FiMessageSquare,
  FiCheckCircle,
  FiBarChart2,
  FiHelpCircle,
  FiUsers,
  FiShield,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";
import { INTENT_LABELS } from "@/lib/types";

export default function AnalyticsPage() {
  const { tenantId } = useTenant();

  // Fetch stats
  const statsQuery = trpc.conversationsAdmin.stats.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const stats = statsQuery.data ?? {
    total: 0,
    resolved: 0,
    escalated: 0,
    resolutionRate: 0,
    escalationRate: 0,
    avgMessages: "0",
    sla: {
      avgFirstResponseMs: null as number | null,
      avgResolutionMs: null as number | null,
      firstResponseCompliance: null as number | null,
      resolutionCompliance: null as number | null,
      totalWithResponse: 0,
      totalResolved: 0,
      currentlyBreaching: 0,
      totalBreached: 0,
      excludeWeekends: true,
      thresholds: { firstResponseMs: 86400000, resolutionMs: 259200000 },
    },
  };

  // Fetch conversations for breakdowns
  const convsQuery = trpc.conversationsAdmin.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const conversations = convsQuery.data ?? [];

  // Fetch departments
  const deptsQuery = trpc.departments.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const departments = deptsQuery.data ?? [];

  const deptBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; solved: number; breached: number }> = {};
    departments.forEach((d) => {
      counts[d.name] = { total: 0, solved: 0, breached: 0 };
    });
    conversations.forEach((c) => {
      const dept = c.departmentName || "Unassigned";
      if (!counts[dept]) counts[dept] = { total: 0, solved: 0, breached: 0 };
      counts[dept].total += 1;
      if (c.status === "resolved") counts[dept].solved += 1;
      if (c.slaStatus === "breached") counts[dept].breached += 1;
    });
    const total = conversations.length || 1;
    return Object.entries(counts)
      .map(([name, c]) => ({
        name,
        conversations: c.total,
        solved: c.solved,
        breached: c.breached,
        pct: Math.round((c.total / total) * 100),
      }))
      .sort((a, b) => b.conversations - a.conversations);
  }, [conversations, departments]);

  const intentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    conversations.forEach((c) => {
      const intent = c.intent || "unknown";
      counts[intent] = (counts[intent] || 0) + 1;
    });
    const total = conversations.length || 1;
    return Object.entries(counts)
      .map(([intent, count]) => ({
        label: INTENT_LABELS[intent] || intent,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [conversations]);

  const topQuestions = useMemo(() => {
    return conversations
      .map((c) => {
        const firstUser = c.messages.find((m) => m.role === "user");
        return {
          question: firstUser?.content || "No message",
          department: c.departmentName || "Unassigned",
          status: c.status,
        };
      })
      .slice(0, 10);
  }, [conversations]);

  const escalatedTickets = useMemo(() => {
    return conversations
      .filter((c) => c.status === "escalated")
      .map((c) => {
        const firstUser = c.messages.find((m) => m.role === "user");
        return {
          question: firstUser?.content || "No message",
          department: c.departmentName || "Unassigned",
        };
      })
      .slice(0, 10);
  }, [conversations]);

  if (!tenantId) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8} maxW="100%">
      <Box mb={6}>
        <Heading size="md" color="gray.800">
          Analytics
        </Heading>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Live conversation metrics from {stats.total} conversation
          {stats.total !== 1 ? "s" : ""}
        </Text>
      </Box>

      {/* Stat Cards */}
      <Flex gap={4} mb={8} flexWrap="wrap">
        <StatCard
          label="Total Conversations"
          value={String(stats.total)}
          icon={FiMessageSquare}
          color="blue"
        />
        <StatCard
          label="Resolution Rate"
          value={stats.total > 0 ? `${stats.resolutionRate}%` : "--"}
          sub={`${stats.resolved} solved`}
          icon={FiCheckCircle}
          color="green"
        />
        <StatCard
          label="Escalation Rate"
          value={stats.total > 0 ? `${stats.escalationRate}%` : "--"}
          sub={`${stats.escalated} escalated`}
          icon={FiAlertCircle}
          color="red"
        />
        <StatCard
          label="Total Solved"
          value={String(stats.resolved)}
          sub={stats.total > 0 ? `${stats.resolutionRate}% of total` : ""}
          icon={FiCheckCircle}
          color="green"
        />
        <StatCard
          label="Total Breached"
          value={String(stats.sla.totalBreached)}
          sub={stats.sla.currentlyBreaching > 0 ? `${stats.sla.currentlyBreaching} currently active` : ""}
          icon={FiAlertCircle}
          color="red"
        />
        <StatCard
          label="Avg. Messages"
          value={stats.avgMessages}
          sub="per conversation"
          icon={FiMessageSquare}
          color="purple"
        />
      </Flex>

      {/* SLA Performance */}
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        p={5}
        mb={8}
      >
        <HStack spacing={2} mb={4}>
          <Icon as={FiShield} color="gray.400" boxSize={4} />
          <Text fontWeight="600" fontSize="sm" color="gray.700">
            SLA Performance
          </Text>
        </HStack>

        <Flex gap={4} mb={5} flexWrap="wrap">
          <MiniStat
            label="Avg First Response"
            value={stats.sla.avgFirstResponseMs != null ? formatDuration(stats.sla.avgFirstResponseMs) : "--"}
            sub={`${stats.sla.totalWithResponse} measured`}
            color="gray"
          />
          <MiniStat
            label="Avg Resolution Time"
            value={stats.sla.avgResolutionMs != null ? formatDuration(stats.sla.avgResolutionMs) : "--"}
            sub={`${stats.sla.totalResolved} resolved`}
            color="gray"
          />
          <MiniStat
            label="Response SLA Met"
            value={stats.sla.firstResponseCompliance != null ? `${stats.sla.firstResponseCompliance}%` : "--"}
            sub={`${stats.sla.totalWithResponse} measured`}
            color="gray"
          />
          <MiniStat
            label="Resolution SLA Met"
            value={stats.sla.resolutionCompliance != null ? `${stats.sla.resolutionCompliance}%` : "--"}
            sub={`${stats.sla.totalResolved} resolved`}
            color="gray"
          />
          <MiniStat
            label="Currently Breaching"
            value={String(stats.sla.currentlyBreaching)}
            sub=""
            color="red"
          />
        </Flex>

        {/* SLA compliance bars */}
        <VStack spacing={3} align="stretch">
          <Box>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="xs" color="gray.600">First Response Compliance</Text>
              <Text fontSize="xs" color="gray.400">
                {stats.sla.firstResponseCompliance != null ? `${stats.sla.firstResponseCompliance}%` : "No data"}
              </Text>
            </Flex>
            <Box bg="gray.100" borderRadius="full" h="8px" overflow="hidden">
              <Box
                bg="gray.800"
                h="100%"
                borderRadius="full"
                w={`${stats.sla.firstResponseCompliance ?? 0}%`}
                transition="width 0.3s"
              />
            </Box>
          </Box>
          <Box>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="xs" color="gray.600">Resolution Compliance</Text>
              <Text fontSize="xs" color="gray.400">
                {stats.sla.resolutionCompliance != null ? `${stats.sla.resolutionCompliance}%` : "No data"}
              </Text>
            </Flex>
            <Box bg="gray.100" borderRadius="full" h="8px" overflow="hidden">
              <Box
                bg="gray.800"
                h="100%"
                borderRadius="full"
                w={`${stats.sla.resolutionCompliance ?? 0}%`}
                transition="width 0.3s"
              />
            </Box>
          </Box>
        </VStack>
      </Box>

      {/* Department Breakdown */}
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        p={5}
        mb={8}
      >
        <HStack spacing={2} mb={4}>
          <Icon as={FiBarChart2} color="gray.400" boxSize={4} />
          <Text fontWeight="600" fontSize="sm" color="gray.700">
            Department Breakdown
          </Text>
        </HStack>
        {deptBreakdown.length === 0 ? (
          <Text fontSize="sm" color="gray.400">
            No conversations yet
          </Text>
        ) : (
          <VStack spacing={3} align="stretch">
            {deptBreakdown.map((dept) => (
              <Box key={dept.name}>
                <Flex justify="space-between" mb={1}>
                  <Text fontSize="sm" color="gray.700">
                    {dept.name}
                  </Text>
                  <HStack spacing={3}>
                    <Badge colorScheme="green" variant="subtle" fontSize="10px">{dept.solved} solved</Badge>
                    {dept.breached > 0 && (
                      <Badge colorScheme="red" variant="subtle" fontSize="10px">{dept.breached} breached</Badge>
                    )}
                    <Text fontSize="xs" color="gray.400">
                      {dept.conversations} ({dept.pct}%)
                    </Text>
                  </HStack>
                </Flex>
                <Box bg="gray.100" borderRadius="full" h="6px" overflow="hidden">
                  <Box
                    bg="blue.400"
                    h="100%"
                    borderRadius="full"
                    w={`${dept.pct}%`}
                    transition="width 0.3s"
                  />
                </Box>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* Intent Breakdown */}
      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        p={5}
        mb={8}
      >
        <HStack spacing={2} mb={4}>
          <Icon as={FiUsers} color="gray.400" boxSize={4} />
          <Text fontWeight="600" fontSize="sm" color="gray.700">
            Intent Breakdown
          </Text>
        </HStack>
        {intentBreakdown.length === 0 ? (
          <Text fontSize="sm" color="gray.400">
            No conversations yet
          </Text>
        ) : (
          <VStack spacing={3} align="stretch">
            {intentBreakdown.map((item) => (
              <Box key={item.label}>
                <Flex justify="space-between" mb={1}>
                  <Text fontSize="sm" color="gray.700">
                    {item.label}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    {item.count} ({item.pct}%)
                  </Text>
                </Flex>
                <Box bg="gray.100" borderRadius="full" h="6px" overflow="hidden">
                  <Box
                    bg="purple.400"
                    h="100%"
                    borderRadius="full"
                    w={`${item.pct}%`}
                    transition="width 0.3s"
                  />
                </Box>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Flex gap={6} flexWrap="wrap">
        {/* Recent Questions */}
        <Box
          flex="1"
          minW="400px"
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={5}
        >
          <HStack spacing={2} mb={4}>
            <Icon as={FiMessageSquare} color="gray.400" boxSize={4} />
            <Text fontWeight="600" fontSize="sm" color="gray.700">
              Recent Questions
            </Text>
          </HStack>
          {topQuestions.length === 0 ? (
            <Text fontSize="sm" color="gray.400">
              No conversations yet
            </Text>
          ) : (
            <VStack spacing={0} align="stretch">
              {topQuestions.map((q, i) => (
                <Flex
                  key={i}
                  py={2.5}
                  align="center"
                  justify="space-between"
                  borderBottom="1px solid"
                  borderColor="gray.50"
                  _last={{ borderBottom: "none" }}
                >
                  <Box flex={1} mr={3}>
                    <Text fontSize="sm" color="gray.700" noOfLines={1}>
                      {q.question}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {q.department}
                    </Text>
                  </Box>
                  <Badge
                    colorScheme={
                      q.status === "resolved"
                        ? "green"
                        : q.status === "escalated"
                          ? "red"
                          : q.status === "new"
                            ? "orange"
                            : "blue"
                    }
                    variant="subtle"
                    fontSize="10px"
                    textTransform="capitalize"
                  >
                    {q.status === "resolved" ? "Solved" : q.status}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          )}
        </Box>

        {/* Escalated Tickets */}
        <Box
          flex="1"
          minW="400px"
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={5}
        >
          <HStack spacing={2} mb={4}>
            <Icon as={FiHelpCircle} color="orange.400" boxSize={4} />
            <Text fontWeight="600" fontSize="sm" color="gray.700">
              Escalated Tickets
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.400" mb={3}>
            Conversations that were escalated and may need attention.
          </Text>
          {escalatedTickets.length === 0 ? (
            <Text fontSize="sm" color="gray.400">
              No escalated tickets
            </Text>
          ) : (
            <VStack spacing={0} align="stretch">
              {escalatedTickets.map((q, i) => (
                <Flex
                  key={i}
                  py={2.5}
                  align="center"
                  justify="space-between"
                  borderBottom="1px solid"
                  borderColor="gray.50"
                  _last={{ borderBottom: "none" }}
                >
                  <Box flex={1} mr={3}>
                    <Text fontSize="sm" color="gray.700" noOfLines={1}>
                      {q.question}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {q.department}
                    </Text>
                  </Box>
                  <Badge colorScheme="red" variant="subtle" fontSize="10px">
                    Escalated
                  </Badge>
                </Flex>
              ))}
            </VStack>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
  return `${(ms / 86400000).toFixed(1)}d`;
}

function MiniStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Box flex="1" minW="140px" bg={`${color}.50`} borderRadius="md" px={3} py={2.5}>
      <Text fontSize="10px" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
      <Text fontSize="lg" fontWeight="700" color={`${color}.600`} mt={0.5}>
        {value}
      </Text>
      <Text fontSize="10px" color="gray.400">
        {sub}
      </Text>
    </Box>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      px={5}
      py={4}
      flex="1"
      minW="180px"
    >
      <HStack justify="space-between" mb={2}>
        <Text fontSize="xs" color="gray.500" fontWeight="500">
          {label}
        </Text>
        <Icon as={icon} color={`${color}.400`} boxSize={4} />
      </HStack>
      <Text fontSize="2xl" fontWeight="700" color="gray.800">
        {value}
      </Text>
      {sub && (
        <Text fontSize="xs" color="gray.400">
          {sub}
        </Text>
      )}
    </Box>
  );
}
