"use client";

import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FiHome,
  FiMap,
  FiUsers,
  FiActivity,
  FiHeart,
  FiShield,
  FiExternalLink,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { TopNav, TopNavLink, type NavItem } from "@/components/TopNav";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: FiHome, exact: true },
  { label: "Institutions", href: "/admin/institutions", icon: FiMap },
  { label: "Users", href: "/admin/users", icon: FiUsers },
  { label: "System", href: "/admin/system", icon: FiActivity },
  { label: "Audit", href: "/admin/audit", icon: FiShield },
  { label: "Health", href: "/admin/health", icon: FiHeart },
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

  // Match the institution branding: use the first tenant's widget color as the
  // nav accent (same tenant the "Dashboard" button routes to).
  const { data: cities } = trpc.admin.listInstitutions.useQuery(undefined, {
    enabled: isLoaded && isSignedIn === true,
  });
  const accentColor = cities?.[0]?.brandColor ?? null;

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
      <Flex minH="100vh" bg="#FBFAF7" align="center" justify="center">
        <Spinner color="brand.500" />
      </Flex>
    );
  }

  const items: NavItem[] = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
    badge:
      item.href === "/admin" || item.href === "/admin/users"
        ? unassignedCount
        : 0,
  }));

  return (
    <Flex direction="column" h="100vh" overflow="hidden" bg="#FBFAF7">
      <TopNav
        brand={{ label: "Campus Assist", href: "/admin", sub: "Tech Admin", markColor: accentColor }}
        items={items}
        right={
          <>
            <Box display={{ base: "none", lg: "block" }}>
              <TopNavLink href="/dashboard" icon={FiExternalLink}>
                Dashboard
              </TopNavLink>
            </Box>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: { width: "30px", height: "30px" } } }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Text fontSize="xs" color="brand.600" cursor="pointer" fontWeight="600" _hover={{ textDecoration: "underline" }}>
                  Sign in
                </Text>
              </SignInButton>
            </SignedOut>
          </>
        }
      />

      <Box flex={1} overflow="auto">
        {children}
      </Box>
    </Flex>
  );
}
