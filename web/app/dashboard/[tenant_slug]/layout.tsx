/**
 * Dashboard layout — sidebar with navigation, tenant info from DB, and user button.
 *
 * No Clerk organization switcher — tenants are managed via our RBAC system.
 */
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
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FiBook,
  FiUsers,
  FiMessageSquare,
  FiBarChart2,
  FiSettings,
  FiShield,
  FiUserPlus,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";
import { useRole } from "@/lib/use-role";

const NAV_ITEMS = [
  { label: "Knowledge Base", href: "/knowledge-base", icon: FiBook, adminOnly: true },
  { label: "Departments", href: "/departments", icon: FiUsers, adminOnly: true },
  { label: "Team", href: "/team", icon: FiUserPlus, adminOnly: true },
  { label: "Conversations", href: "/conversations", icon: FiMessageSquare, adminOnly: false },
  { label: "Analytics", href: "/analytics", icon: FiBarChart2, adminOnly: true },
  { label: "Settings", href: "/settings", icon: FiSettings, adminOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const slug = params.tenant_slug as string;
  const { tenant } = useTenant();
  const { role, isTechAdmin, isCityAdmin } = useRole();
  const { data: memberships, isLoading: membershipsLoading } = trpc.me.memberships.useQuery(
    undefined,
    { enabled: isLoaded && !!isSignedIn },
  );

  const roleLabel = role
    ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  const basePath = `/dashboard/${slug}`;

  // Redirect if not signed in or no active membership for this tenant
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }
    if (membershipsLoading || !memberships) return;
    const hasAccess = memberships.some(
      (m) => m.tenantSlug === slug || m.tenantId === null,
    );
    if (!hasAccess) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, memberships, membershipsLoading, slug, router]);

  // Show loading while checking access
  if (!isLoaded || membershipsLoading) {
    return (
      <Flex h="100vh" align="center" justify="center">
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
        {/* Logo + Tenant */}
        <Box px={5} py={5} borderBottom="1px solid" borderColor="gray.700">
          <Text fontSize="xl" fontWeight="bold" color="blue.300" mb={2}>
            Campus Assist
          </Text>
          <SignedIn>
            {tenant && (
              <>
                <Text fontSize="xs" color="gray.500">
                  Institution
                </Text>
                <Text fontSize="13px" fontWeight="600" color="gray.200">
                  {tenant.name}
                </Text>
              </>
            )}
            {roleLabel && (
              <Text fontSize="11px" color="gray.400" mt={0.5}>
                {roleLabel}
              </Text>
            )}
          </SignedIn>
          <SignedOut>
            <Text fontSize="xs" color="gray.400">
              Not signed in
            </Text>
          </SignedOut>
        </Box>

        {/* Nav Links */}
        <VStack spacing={1} align="stretch" px={3} py={4} flex={1}>
          {NAV_ITEMS.filter((item) => !item.adminOnly || isTechAdmin || isCityAdmin).map((item) => {
            const fullPath = `${basePath}${item.href}`;
            const isActive = pathname.startsWith(fullPath);
            return (
              <ChakraLink
                as={NextLink}
                key={item.href}
                href={fullPath}
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
              </ChakraLink>
            );
          })}
        </VStack>

        {/* Tech Admin Link */}
        {isTechAdmin && (
          <Box px={3} pb={2}>
            <ChakraLink
              as={NextLink}
              href="/admin"
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
              <Icon as={FiShield} boxSize={3} />
              Tech Dashboard
            </ChakraLink>
          </Box>
        )}

        {/* User */}
        <Box px={5} py={4} borderTop="1px solid" borderColor="gray.700">
          <SignedIn>
            <HStack spacing={3}>
              <UserButton
                afterSignOutUrl="/"
                showName={false}
                appearance={{
                  elements: {
                    avatarBox: { width: "28px", height: "28px" },
                    ...(!isTechAdmin && {
                      userButtonPopoverActionButton__manageAccount: {
                        display: "none",
                      },
                    }),
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
      <Box flex={1} overflow="auto" bg="white">
        {children}
      </Box>
    </Flex>
  );
}
