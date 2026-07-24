/**
 * Dashboard layout — horizontal top nav with tenant info and user menu.
 *
 * No Clerk organization switcher — tenants are managed via our RBAC system.
 */
"use client";

import { Box, Flex, Text, Badge, Spinner } from "@chakra-ui/react";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FiBook,
  FiUsers,
  FiMessageSquare,
  FiBarChart2,
  FiSettings,
  FiShield,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";
import { useRole } from "@/lib/use-role";
import { TopNav, TopNavLink, type NavItem } from "@/components/TopNav";

const NAV_ITEMS = [
  { label: "Knowledge Base", href: "/knowledge-base", icon: FiBook, adminOnly: true },
  { label: "Departments", href: "/departments", icon: FiUsers, adminOnly: true },
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
      <Flex h="100vh" align="center" justify="center" bg="#FBFAF7">
        <Spinner color="brand.500" />
      </Flex>
    );
  }

  const items: NavItem[] = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isTechAdmin || isCityAdmin,
  ).map((item) => {
    const fullPath = `${basePath}${item.href}`;
    return {
      label: item.label,
      href: fullPath,
      icon: item.icon,
      active: pathname.startsWith(fullPath),
    };
  });

  return (
    <Flex direction="column" h="100vh" overflow="hidden" bg="#FBFAF7">
      <TopNav
        brand={{ label: "Campus Assist", href: basePath, sub: tenant?.name, markColor: tenant?.brandColor }}
        items={items}
        right={
          <>
            {roleLabel && (
              <Badge
                display={{ base: "none", md: "inline-flex" }}
                colorScheme="brand"
                bg="brand.50"
                color="ink.700"
                fontSize="11px"
              >
                {roleLabel}
              </Badge>
            )}
            {isTechAdmin && (
              <Box display={{ base: "none", lg: "block" }}>
                <TopNavLink href="/admin" icon={FiShield}>
                  Tech Dashboard
                </TopNavLink>
              </Box>
            )}
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                showName={false}
                appearance={{
                  elements: {
                    avatarBox: { width: "30px", height: "30px" },
                    ...(!isTechAdmin && {
                      userButtonPopoverActionButton__manageAccount: { display: "none" },
                    }),
                  },
                }}
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
