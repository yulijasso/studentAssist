"use client";

import {
  Box,
  Flex,
  VStack,
  Text,
  Icon,
  Link as ChakraLink,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FiHome,
  FiMap,
  FiMail,
  FiUsers,
  FiActivity,
  FiExternalLink,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";

/**
 * Animated notification pill shown next to nav items with pending actions.
 */
function NotifBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Flex ml="auto" position="relative" align="center" justify="center">
      <Box
        position="absolute"
        w="100%"
        h="100%"
        borderRadius="full"
        bg="#FF6B6B"
        opacity={0.4}
        animation="notifPulse 2s ease-in-out infinite"
        sx={{
          "@keyframes notifPulse": {
            "0%, 100%": { transform: "scale(1)", opacity: 0.4 },
            "50%": { transform: "scale(1.5)", opacity: 0 },
          },
        }}
      />
      <Flex
        minW="20px"
        h="20px"
        px={1.5}
        bg="#FF6B6B"
        borderRadius="full"
        align="center"
        justify="center"
        boxShadow="0 0 8px rgba(255, 107, 107, 0.5)"
      >
        <Text fontSize="10px" fontWeight="700" color="white" lineHeight={1}>
          {count > 9 ? "9+" : count}
        </Text>
      </Flex>
    </Flex>
  );
}

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: FiHome, exact: true },
  { label: "Cities", href: "/admin/cities", icon: FiMap },
  { label: "Invitations", href: "/admin/invitations", icon: FiMail },
  { label: "Users", href: "/admin/users", icon: FiUsers },
  { label: "System", href: "/admin/system", icon: FiActivity },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Check tech_admin role via system health (if this fails, user is not tech_admin)
  const healthCheck = trpc.admin.systemHealth.useQuery(undefined, {
    retry: false,
    enabled: isLoaded && isSignedIn === true,
  });

  // Fetch unassigned user count for notification badge
  const { data: userStats } = trpc.admin.userStats.useQuery(undefined, {
    enabled: isLoaded && isSignedIn === true,
    refetchInterval: 30_000,
  });
  const unassignedCount = userStats?.unassignedUsers ?? 0;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }
  }, [isLoaded, isSignedIn, router]);

  // If the admin query fails with UNAUTHORIZED, redirect
  useEffect(() => {
    if (healthCheck.error?.data?.code === "UNAUTHORIZED") {
      router.replace("/");
    }
  }, [healthCheck.error, router]);

  if (!isLoaded || healthCheck.isLoading) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" overflow="hidden">
      {/* Sidebar */}
      <Box
        w="240px"
        bg="gray.900"
        color="white"
        flexShrink={0}
        display="flex"
        flexDirection="column"
      >
        {/* Header */}
        <Box px={5} py={5} borderBottom="1px solid" borderColor="gray.700">
          <Text fontSize="xl" fontWeight="bold" color="blue.300">
            Campus Assist
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Tech Admin Dashboard
          </Text>
        </Box>

        {/* Nav Links */}
        <VStack spacing={1} align="stretch" px={3} py={4} flex={1}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const badge =
              (item.href === "/admin" || item.href === "/admin/users")
                ? unassignedCount
                : 0;
            return (
              <ChakraLink
                as={NextLink}
                key={item.href}
                href={item.href}
                display="flex"
                alignItems="center"
                gap={3}
                px={3}
                py={2.5}
                borderRadius="md"
                fontSize="sm"
                fontWeight={isActive ? "600" : "400"}
                bg={isActive ? "blue.600" : "transparent"}
                color={isActive ? "white" : "gray.300"}
                _hover={{
                  bg: isActive ? "blue.600" : "gray.800",
                  color: "white",
                  textDecoration: "none",
                }}
                transition="all 0.15s"
              >
                <Icon as={item.icon} boxSize={4} />
                {item.label}
                <NotifBadge count={badge} />
              </ChakraLink>
            );
          })}
        </VStack>

        {/* City Dashboard Link */}
        <Box px={3} pb={2}>
          <ChakraLink
            as={NextLink}
            href="/dashboard"
            display="flex"
            alignItems="center"
            gap={2}
            px={3}
            py={2}
            borderRadius="md"
            fontSize="xs"
            color="gray.400"
            _hover={{ bg: "gray.800", color: "white", textDecoration: "none" }}
            transition="all 0.15s"
          >
            <Icon as={FiExternalLink} boxSize={3} />
            City Dashboard
          </ChakraLink>
        </Box>

        {/* User */}
        <Box px={5} py={4} borderTop="1px solid" borderColor="gray.700">
          <SignedIn>
            <HStack spacing={3}>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: { width: "28px", height: "28px" },
                  },
                }}
              />
            </HStack>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Text
                fontSize="xs"
                color="blue.300"
                cursor="pointer"
                _hover={{ textDecoration: "underline" }}
              >
                Sign in
              </Text>
            </SignInButton>
          </SignedOut>
        </Box>
      </Box>

      {/* Main Content */}
      <Box flex={1} overflow="auto" bg="gray.50">
        {children}
      </Box>
    </Flex>
  );
}
