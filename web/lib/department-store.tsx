"use client";

import { trpc } from "@/lib/trpc";

export function useDepartments(tenantId: string | null) {
  const query = trpc.departments.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );

  const departments = (query.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    email: d.email,
    phone: d.phone,
  }));

  return { departments, isLoading: query.isLoading };
}
