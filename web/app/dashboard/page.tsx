/**
 * Dashboard index — redirects to the user's first tenant or back to home.
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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }
    if (isLoading || !memberships) return;

    const tenantMembership = memberships.find((m) => m.tenantSlug);
    if (tenantMembership?.tenantSlug) {
      router.replace(`/dashboard/${tenantMembership.tenantSlug}/conversations`);
    } else {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, memberships, isLoading, router]);

  return (
    <Flex minH="100vh" align="center" justify="center">
      <Spinner color="blue.500" />
    </Flex>
  );
}
