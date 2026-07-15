/**
 * Tech Admin dashboard overview — high-level summary of cities, users,
 * invitations, and platform activity in a clean card-based layout.
 */
"use client";

import {
  Box,
  Flex,
  Text,
  SimpleGrid,
  Spinner,
  Icon,
  HStack,
  VStack,
  Link as ChakraLink,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Progress,
} from "@chakra-ui/react";
import NextLink from "next/link";
import {
  FiMap,
  FiMessageSquare,
  FiUsers,
  FiUserPlus,
  FiMail,
  FiUserCheck,
  FiZap,
  FiActivity,
  FiArrowRight,
  FiTrendingUp,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";

export default function AdminOverviewPage() {
  const { data: overview, isLoading: overviewLoading } = trpc.admin.overview.useQuery();
  const { data: userStats, isLoading: userStatsLoading } = trpc.admin.userStats.useQuery();
  const { data: cities } = trpc.admin.listCities.useQuery();
  const { data: invitations } = trpc.admin.listInvitations.useQuery();
  const { data: usage } = trpc.admin.platformUsage.useQuery();
  const { data: activity } = trpc.admin.recentActivity.useQuery();
  const { data: allUsers } = trpc.admin.listUsers.useQuery();

  if (overviewLoading || userStatsLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  const pendingInvites = invitations?.filter((i) => i.status === "pending").length ?? 0;
  const acceptedInvites = invitations?.filter((i) => i.status === "accepted").length ?? 0;
  const activeCities = cities?.filter((c) => c.isActive).length ?? 0;
  const inactiveCities = (cities?.length ?? 0) - activeCities;
  const activeUsers = userStats?.totalUsers ?? 0;
  const unassigned = userStats?.unassignedUsers ?? 0;
  const convosToday = overview?.conversationsToday ?? 0;
  const totalConvos = usage?.totalConversations ?? 0;
  const totalMessages = usage?.totalMessages ?? 0;

  // Unassigned users (signed in but no membership)
  const unassignedUsers = (allUsers ?? []).filter((u) => u.memberships.length === 0);

  return (
    <Box p={8} maxW="1200px">
      {/* Page Header */}
      <Box mb={8}>
        <Text fontSize="2xl" fontWeight="700" color="gray.800">
          Overview
        </Text>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Platform summary at a glance
        </Text>
      </Box>

      {/* Access Requests Banner */}
      {unassignedUsers.length > 0 && (
        <Box
          bg="orange.50"
          border="1px solid"
          borderColor="orange.200"
          borderRadius="lg"
          px={5}
          py={4}
          mb={6}
        >
          <Flex justify="space-between" align="center" mb={3}>
            <HStack spacing={2}>
              <Icon as={FiAlertCircle} boxSize={4} color="orange.500" />
              <Text fontSize="sm" fontWeight="600" color="orange.800">
                {unassignedUsers.length} user{unassignedUsers.length !== 1 ? "s" : ""} waiting for access
              </Text>
            </HStack>
            <ChakraLink
              as={NextLink}
              href="/admin/invitations"
              fontSize="xs"
              color="orange.600"
              fontWeight="500"
              _hover={{ textDecoration: "underline" }}
            >
              Send invitations
            </ChakraLink>
          </Flex>
          <VStack align="stretch" spacing={0}>
            {unassignedUsers.slice(0, 5).map((u) => (
              <Flex
                key={u.id}
                align="center"
                justify="space-between"
                py={1.5}
                borderBottom="1px solid"
                borderColor="orange.100"
                _last={{ borderBottom: "none" }}
              >
                <HStack spacing={2}>
                  <Box w="6px" h="6px" borderRadius="full" bg="orange.400" />
                  <Text fontSize="12px" color="orange.900" fontWeight="500">
                    {u.name ?? "—"}
                  </Text>
                  <Text fontSize="11px" color="orange.600">
                    {u.email}
                  </Text>
                </HStack>
                <Text fontSize="10px" color="orange.400">
                  {formatTimeAgo(u.createdAt)}
                </Text>
              </Flex>
            ))}
            {unassignedUsers.length > 5 && (
              <Text fontSize="11px" color="orange.500" pt={2} textAlign="center">
                +{unassignedUsers.length - 5} more
              </Text>
            )}
          </VStack>
        </Box>
      )}

      {/* Hero Metrics */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
        <HeroCard
          label="Active Cities"
          value={activeCities}
          sub={`${inactiveCities} inactive`}
          color="blue"
          icon={FiMap}
        />
        <HeroCard
          label="Total Users"
          value={activeUsers}
          sub={`${userStats?.recentSignups ?? 0} this week`}
          color="teal"
          icon={FiUsers}
        />
        <HeroCard
          label="Conversations Today"
          value={convosToday}
          sub={`${totalConvos.toLocaleString()} total`}
          color="purple"
          icon={FiMessageSquare}
        />
        <HeroCard
          label="Pending Invitations"
          value={pendingInvites}
          sub={`${acceptedInvites} accepted`}
          color="gray"
          icon={FiMail}
        />
      </SimpleGrid>

      {/* Two-Column Layout */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5} mb={8}>
        {/* Cities Summary */}
        <SectionCard title="Cities" href="/admin/cities" icon={FiMap} iconColor="blue.400">
          {cities && cities.length > 0 ? (
            <VStack align="stretch" spacing={0}>
              {cities.slice(0, 5).map((city) => (
                <Flex
                  key={city.id}
                  justify="space-between"
                  align="center"
                  py={2}
                  borderBottom="1px solid"
                  borderColor="gray.50"
                  _last={{ borderBottom: "none" }}
                >
                  <HStack spacing={2.5}>
                    <Box
                      w="7px"
                      h="7px"
                      borderRadius="full"
                      bg={city.isActive ? "green.400" : "red.300"}
                    />
                    <Text fontSize="13px" color="gray.700" fontWeight="500">
                      {city.name}
                    </Text>
                  </HStack>
                  <HStack spacing={3}>
                    <Text fontSize="11px" color="gray.400">
                      {city.conversationCount ?? 0} convos
                    </Text>
                    <Badge
                      fontSize="10px"
                      colorScheme={city.isActive ? "green" : "red"}
                      variant="subtle"
                      borderRadius="full"
                      px={2}
                    >
                      {city.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </HStack>
                </Flex>
              ))}
              {cities.length > 5 && (
                <Text fontSize="11px" color="gray.400" pt={2} textAlign="center">
                  +{cities.length - 5} more
                </Text>
              )}
            </VStack>
          ) : (
            <EmptyState text="No cities registered" />
          )}
        </SectionCard>

        {/* Users Summary */}
        <SectionCard title="Users" href="/admin/users" icon={FiUsers} iconColor="teal.400">
          <VStack align="stretch" spacing={3}>
            {/* Role Breakdown */}
            {userStats?.byRole && userStats.byRole.length > 0 ? (
              userStats.byRole.map((r) => {
                const total = userStats.totalUsers || 1;
                const pct = Math.round((r.count / total) * 100);
                return (
                  <Box key={r.role}>
                    <Flex justify="space-between" mb={1}>
                      <HStack spacing={2}>
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="full"
                          bg={ROLE_COLORS[r.role] ?? "gray.400"}
                        />
                        <Text fontSize="12px" color={ROLE_COLORS[r.role] ?? "gray.400"} fontWeight="500">
                          {formatRoleName(r.role)}
                        </Text>
                      </HStack>
                      <Text fontSize="12px" fontWeight="600" color={ROLE_COLORS[r.role] ?? "gray.700"}>
                        {r.count}
                      </Text>
                    </Flex>
                    <Progress
                      value={pct}
                      size="xs"
                      borderRadius="full"
                      colorScheme={ROLE_COLOR_SCHEME[r.role] ?? "gray"}
                    />
                  </Box>
                );
              })
            ) : (
              <EmptyState text="No memberships yet" />
            )}
            {unassigned > 0 && (
              <Flex
                align="center"
                gap={2}
                bg="orange.50"
                border="1px solid"
                borderColor="orange.100"
                borderRadius="md"
                px={3}
                py={2}
              >
                <Icon as={FiAlertCircle} boxSize={3.5} color="orange.500" />
                <Text fontSize="12px" color="orange.700">
                  {unassigned} unassigned user{unassigned !== 1 ? "s" : ""}
                </Text>
              </Flex>
            )}
          </VStack>
        </SectionCard>

        {/* Invitations Summary */}
        <SectionCard title="Invitations" href="/admin/invitations" icon={FiMail} iconColor="gray.400">
          <SimpleGrid columns={3} spacing={3} mb={3}>
            <MiniStat label="Pending" value={pendingInvites} color="yellow.500" />
            <MiniStat label="Accepted" value={acceptedInvites} color="green.500" />
            <MiniStat
              label="Expired"
              value={(invitations?.length ?? 0) - pendingInvites - acceptedInvites}
              color="red.400"
            />
          </SimpleGrid>
          <Box bg="gray.50" borderRadius="md" p={3}>
            <HStack justify="space-between">
              <Text fontSize="12px" color="gray.500">Total Sent</Text>
              <Text fontSize="13px" fontWeight="600" color="gray.700">
                {invitations?.length ?? 0}
              </Text>
            </HStack>
          </Box>
        </SectionCard>

        {/* Platform Activity */}
        <SectionCard title="Platform Activity" href="/admin/system" icon={FiActivity} iconColor="purple.400">
          <SimpleGrid columns={3} spacing={3} mb={3}>
            <MiniStat label="Messages" value={totalMessages} color="purple.500" />
            <MiniStat label="Conversations" value={totalConvos} color="cyan.500" />
            <MiniStat
              label="Avg / Convo"
              value={totalConvos ? Math.round(totalMessages / totalConvos) : 0}
              color="teal.500"
            />
          </SimpleGrid>
          {usage?.perCity && usage.perCity.length > 0 && (
            <Box>
              <Text fontSize="11px" color="gray.400" mb={2} fontWeight="500">
                Conversations by City
              </Text>
              <VStack align="stretch" spacing={1.5}>
                {usage.perCity.slice(0, 4).map((c) => {
                  const maxTotal = Math.max(...usage.perCity!.map((x) => x.total), 1);
                  const pct = Math.round((c.total / maxTotal) * 100);
                  return (
                    <Flex key={c.tenantId} align="center" gap={3}>
                      <Text fontSize="11px" color="gray.600" w="90px" flexShrink={0} isTruncated>
                        {c.cityName}
                      </Text>
                      <Box flex={1} bg="gray.100" borderRadius="full" h="6px" overflow="hidden">
                        <Box
                          bg="purple.400"
                          h="100%"
                          borderRadius="full"
                          w={`${pct}%`}
                          transition="width 0.3s"
                        />
                      </Box>
                      <Text fontSize="10px" color="gray.500" w="30px" textAlign="right">
                        {c.total}
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            </Box>
          )}
        </SectionCard>
      </SimpleGrid>

      {/* Recent Signups */}
      {activity && activity.length > 0 && (
        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          overflow="hidden"
        >
          <Flex
            px={5}
            py={3}
            borderBottom="1px solid"
            borderColor="gray.100"
            justify="space-between"
            align="center"
          >
            <HStack spacing={2}>
              <Icon as={FiClock} boxSize={3.5} color="orange.400" />
              <Text fontSize="sm" fontWeight="600" color="gray.700">
                Recent Signups
              </Text>
            </HStack>
            <ChakraLink
              as={NextLink}
              href="/admin/users"
              fontSize="xs"
              color="blue.500"
              _hover={{ textDecoration: "underline" }}
            >
              View all
            </ChakraLink>
          </Flex>
          <Table size="sm" variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th fontSize="10px" py={2}>User</Th>
                <Th fontSize="10px" py={2}>Role</Th>
                <Th fontSize="10px" py={2}>Joined</Th>
              </Tr>
            </Thead>
            <Tbody>
              {activity.slice(0, 5).map((u) => (
                <Tr key={u.id}>
                  <Td py={2}>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="12px" fontWeight="500" color="gray.800">
                        {u.name ?? "—"}
                      </Text>
                      <Text fontSize="10px" color="gray.400">
                        {u.email}
                      </Text>
                    </VStack>
                  </Td>
                  <Td py={2}>
                    {u.memberships.length > 0 ? (
                      <HStack spacing={1} flexWrap="wrap">
                        {u.memberships.map((m, i) => (
                          <Badge
                            key={i}
                            colorScheme={ROLE_COLOR_SCHEME[m.role] ?? "gray"}
                            fontSize="10px"
                          >
                            {m.role}{m.city ? ` · ${m.city}` : ""}
                          </Badge>
                        ))}
                      </HStack>
                    ) : (
                      <Badge colorScheme="orange" fontSize="10px">
                        Unassigned
                      </Badge>
                    )}
                  </Td>
                  <Td py={2}>
                    <Text fontSize="11px" color="gray.500">
                      {formatTimeAgo(u.createdAt)}
                    </Text>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

/* ─── Sub-components ─── */

/** Large metric card for the top hero row. */
function HeroCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      p={5}
    >
      <Flex
        w={8}
        h={8}
        bg={`${color}.50`}
        borderRadius="lg"
        align="center"
        justify="center"
        mb={3}
      >
        <Icon as={icon} boxSize={4} color={`${color}.500`} />
      </Flex>
      <Text fontSize="2xl" fontWeight="700" color="gray.800" lineHeight={1}>
        {value.toLocaleString()}
      </Text>
      <Text fontSize="xs" fontWeight="500" color="gray.600" mt={1}>
        {label}
      </Text>
      <Text fontSize="11px" color="gray.400" mt={0.5}>
        {sub}
      </Text>
    </Box>
  );
}

/** Card wrapper for each section. */
function SectionCard({
  title,
  href,
  icon,
  iconColor,
  children,
}: {
  title: string;
  href: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      overflow="hidden"
    >
      <Flex
        px={5}
        py={3}
        borderBottom="1px solid"
        borderColor="gray.100"
        justify="space-between"
        align="center"
      >
        <HStack spacing={2}>
          <Icon as={icon} boxSize={3.5} color={iconColor ?? "gray.400"} />
          <Text fontSize="sm" fontWeight="600" color="gray.700">
            {title}
          </Text>
        </HStack>
        <ChakraLink
          as={NextLink}
          href={href}
          fontSize="xs"
          color="blue.500"
          display="flex"
          alignItems="center"
          gap={1}
          _hover={{ textDecoration: "underline" }}
        >
          View <Icon as={FiArrowRight} boxSize={3} />
        </ChakraLink>
      </Flex>
      <Box px={5} py={4}>
        {children}
      </Box>
    </Box>
  );
}

/** Small stat block used inside section cards. */
function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box bg="gray.50" borderRadius="md" p={3} textAlign="center">
      <Text fontSize="lg" fontWeight="700" color={color} lineHeight={1}>
        {value.toLocaleString()}
      </Text>
      <Text fontSize="10px" color="gray.500" mt={1}>
        {label}
      </Text>
    </Box>
  );
}

/** Placeholder for empty states. */
function EmptyState({ text }: { text: string }) {
  return (
    <Flex align="center" justify="center" py={4}>
      <Text fontSize="xs" color="gray.400">
        {text}
      </Text>
    </Flex>
  );
}

/* ─── Constants & helpers ─── */

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple.400",
  city_admin: "blue.400",
  supervisor: "teal.400",
  staff: "cyan.400",
  member: "gray.400",
};

const ROLE_COLOR_SCHEME: Record<string, string> = {
  tech_admin: "purple",
  city_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

/** Formats a role slug into a readable name. */
function formatRoleName(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a date as a relative time string. */
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
