/**
 * System page — user statistics, platform usage, and recent activity.
 */
"use client";

import {
  Box,
  Flex,
  Text,
  Badge,
  SimpleGrid,
  Spinner,
  Icon,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Stat,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react";
import {
  FiUsers,
  FiUserPlus,
  FiMail,
  FiUserCheck,
  FiMessageSquare,
  FiTrendingUp,
  FiClock,
  FiZap,
  FiActivity,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple",
  city_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

export default function AdminSystemPage() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.userStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: usage, isLoading: usageLoading } = trpc.admin.platformUsage.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: activity, isLoading: activityLoading } = trpc.admin.recentActivity.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: usageStats, isLoading: usageStatsLoading } = trpc.admin.usageStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  if (statsLoading || usageLoading || activityLoading || usageStatsLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8}>
      {/* User Stats */}
      <Text fontSize="2xl" fontWeight="700" color="gray.800" mb={6}>
        User Stats
      </Text>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard
          icon={FiUsers}
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          color="blue"
        />
        <StatCard
          icon={FiUserPlus}
          label="Joined This Week"
          value={stats?.recentSignups ?? 0}
          color="teal"
        />
        <StatCard
          icon={FiMail}
          label="Pending Invites"
          value={stats?.pendingInvitations ?? 0}
          color="orange"
        />
        <StatCard
          icon={FiUserCheck}
          label="Unassigned"
          value={stats?.unassignedUsers ?? 0}
          color="pink"
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={8}>
        {/* By Role */}
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={6}
        >
          <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
            Users by Role
          </Text>
          {stats?.byRole && stats.byRole.length > 0 ? (
            <VStack align="stretch" spacing={3}>
              {stats.byRole.map((r) => (
                <Flex key={r.role} justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Box
                      w="8px"
                      h="8px"
                      borderRadius="full"
                      bg={`${ROLE_COLORS[r.role] ?? "gray"}.400`}
                    />
                    <Text fontSize="sm" color={`${ROLE_COLORS[r.role] ?? "gray"}.500`} fontWeight="500">
                      {r.role}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="600" color={`${ROLE_COLORS[r.role] ?? "gray"}.500`}>
                    {r.count}
                  </Text>
                </Flex>
              ))}
            </VStack>
          ) : (
            <Text fontSize="xs" color="gray.400">No memberships yet</Text>
          )}
        </Box>

        {/* By City */}
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={6}
        >
          <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
            Users by City
          </Text>
          {stats?.byCity && stats.byCity.length > 0 ? (
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th px={0} fontSize="10px">City</Th>
                  <Th px={0} fontSize="10px" isNumeric>Users</Th>
                </Tr>
              </Thead>
              <Tbody>
                {stats.byCity.map((c) => (
                  <Tr key={c.tenantId}>
                    <Td px={0} fontSize="xs" color="gray.700">{c.cityName}</Td>
                    <Td px={0} fontSize="xs" fontWeight="600" isNumeric>{c.count}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Text fontSize="xs" color="gray.400">No city memberships yet</Text>
          )}
        </Box>
      </SimpleGrid>

      {/* Platform Usage */}
      <Text fontSize="2xl" fontWeight="700" color="gray.800" mb={6}>
        Platform Usage
      </Text>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={6}>
        <StatCard
          icon={FiMessageSquare}
          label="Total Conversations"
          value={usage?.totalConversations ?? 0}
          color="purple"
        />
        <StatCard
          icon={FiTrendingUp}
          label="Conversations Today"
          value={usage?.conversationsToday ?? 0}
          color="cyan"
        />
        <StatCard
          icon={FiMessageSquare}
          label="Total Messages"
          value={usage?.totalMessages ?? 0}
          color="blue"
        />
      </SimpleGrid>

      {usage?.perCity && usage.perCity.length > 0 && (
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={6}
          mb={8}
        >
          <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
            Conversations by City
          </Text>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th px={0} fontSize="10px">City</Th>
                <Th px={0} fontSize="10px" isNumeric>Today</Th>
                <Th px={0} fontSize="10px" isNumeric>Total</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usage.perCity.map((c) => (
                <Tr key={c.tenantId}>
                  <Td px={0} fontSize="xs" color="gray.700">{c.cityName}</Td>
                  <Td px={0} fontSize="xs" fontWeight="600" isNumeric>
                    {c.today}
                  </Td>
                  <Td px={0} fontSize="xs" fontWeight="600" isNumeric>
                    {c.total}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* API Usage Stats */}
      <Text fontSize="2xl" fontWeight="700" color="gray.800" mb={6}>
        API Usage
      </Text>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={6}>
        <StatCard
          icon={FiZap}
          label="Requests Today"
          value={usageStats?.totalRequestsToday ?? 0}
          color="orange"
        />
        <StatCard
          icon={FiActivity}
          label="Active Cities"
          value={usageStats?.cities.filter((c) => c.requestsToday > 0).length ?? 0}
          color="teal"
        />
        <StatCard
          icon={FiUsers}
          label="Total Cities"
          value={usageStats?.cities.length ?? 0}
          color="blue"
        />
      </SimpleGrid>

      {usageStats?.cities && usageStats.cities.length > 0 && (
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          p={6}
          mb={8}
        >
          <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
            Requests by City (Today)
          </Text>
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th px={0} fontSize="10px" py={2}>City</Th>
                <Th px={0} fontSize="10px" py={2} isNumeric>Requests</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usageStats.cities.map((c) => (
                  <Tr key={c.tenantId}>
                    <Td px={0} fontSize="xs" color="gray.700">{c.cityName}</Td>
                    <Td px={0} fontSize="xs" fontWeight="600" isNumeric>
                      {c.requestsToday.toLocaleString()}
                    </Td>
                  </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Recent Activity */}
      <Text fontSize="2xl" fontWeight="700" color="gray.800" mb={6}>
        Recent Activity
      </Text>

      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        p={6}
      >
        <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
          Latest Signups
        </Text>
        {activity && activity.length > 0 ? (
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th px={0} fontSize="10px" py={2}>User</Th>
                <Th px={0} fontSize="10px" py={2}>Role</Th>
                <Th px={0} fontSize="10px" py={2}>Joined</Th>
              </Tr>
            </Thead>
            <Tbody>
              {activity.map((u) => (
                <Tr key={u.id}>
                  <Td px={0}>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xs" fontWeight="600" color="gray.800">
                        {u.name ?? "—"}
                      </Text>
                      <Text fontSize="10px" color="gray.500">
                        {u.email}
                      </Text>
                    </VStack>
                  </Td>
                  <Td px={0}>
                    {u.memberships.length > 0 ? (
                      <VStack align="start" spacing={1}>
                        {u.memberships.map((m, i) => (
                          <Badge
                            key={i}
                            colorScheme={ROLE_COLORS[m.role] ?? "gray"}
                            fontSize="10px"
                          >
                            {m.role}{m.city ? ` · ${m.city}` : ""}
                          </Badge>
                        ))}
                      </VStack>
                    ) : (
                      <Badge colorScheme="orange" fontSize="10px">
                        Unassigned
                      </Badge>
                    )}
                  </Td>
                  <Td px={0}>
                    <HStack spacing={1}>
                      <Icon as={FiClock} boxSize={3} color="gray.400" />
                      <Text fontSize="10px" color="gray.500">
                        {formatTimeAgo(u.createdAt)}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Text fontSize="xs" color="gray.400">No users yet</Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Stat card with icon, label, and value.
 */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      p={4}
    >
      <Flex align="center" gap={2} mb={2}>
        <Flex
          w={7}
          h={7}
          bg={`${color}.50`}
          borderRadius="md"
          align="center"
          justify="center"
        >
          <Icon as={icon} boxSize={3.5} color={`${color}.500`} />
        </Flex>
      </Flex>
      <Stat>
        <StatNumber fontSize="xl" color="gray.800">
          {value}
        </StatNumber>
        <StatLabel fontSize="xs" color="gray.500">
          {label}
        </StatLabel>
      </Stat>
    </Box>
  );
}

/**
 * Format a date as a relative time string (e.g. "2h ago", "3d ago").
 */
function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}
