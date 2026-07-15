/**
 * Resolves the current tenant by URL slug.
 *
 * Fetches the tenant from the database via tRPC. No auto-provisioning —
 * tenants are created manually by tech admins.
 */
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

export function useTenant() {
  const params = useParams();
  const slug = params.tenant_slug as string;

  const { data: tenant, isLoading, error } = trpc.tenants.getBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  return {
    tenant: tenant ?? null,
    tenantId: tenant?.id ?? null,
    slug,
    isLoading,
    error: error?.message ?? null,
  };
}
