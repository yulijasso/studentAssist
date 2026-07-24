/**
 * Dashboard index — routes the user to a per-institution dashboard.
 *
 * - Users with a tenant membership go to their own tenant.
 * - Tech admins (no tenant-scoped membership) fall back to the first
 *   institution in the system, so "City Dashboard" from the admin area works.
 * - Otherwise, back to home.
 */
"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Flex, Spinner } from "@chakra-ui/react";
import { trpc } from "@/lib/trpc";

export default function DashboardIndexPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const { data: memberships, isLoading } = trpc.me.memberships.useQuery(
    undefined,
    { enabled: isLoaded && !!isSignedIn },
  );

  const tenantMembership = memberships?.find((m) => m.tenantSlug);

  // Tech admins have only a global membership (no tenantSlug); fall back to the
  // first institution. listCities is tech-admin-only, so only query when needed.
  const needsCities =
    isLoaded && !!isSignedIn && !isLoading && !!memberships && !tenantMembership;
  const {
    data: cities,
    isLoading: citiesLoading,
    isError: citiesError,
  } = trpc.admin.listCities.useQuery(undefined, {
    enabled: needsCities,
    retry: false,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }
    if (isLoading || !memberships) return;

    if (tenantMembership?.tenantSlug) {
      router.replace(`/dashboard/${tenantMembership.tenantSlug}/conversations`);
      return;
    }

    // No tenant membership → tech admin path: route to the first institution.
    if (needsCities) {
      if (citiesLoading) return;
      if (cities && cities.length > 0) {
        router.replace(`/dashboard/${cities[0].slug}/conversations`);
      } else if (citiesError || (cities && cities.length === 0)) {
        router.replace("/");
      }
    }
  }, [
    isLoaded,
    isSignedIn,
    memberships,
    isLoading,
    tenantMembership,
    needsCities,
    cities,
    citiesLoading,
    citiesError,
    router,
  ]);

  return (
    <Flex minH="100vh" align="center" justify="center" bg="#FBFAF7">
      <Spinner color="brand.500" />
    </Flex>
  );
}
