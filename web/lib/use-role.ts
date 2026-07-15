/**
 * Hook to get the current user's role from our RBAC system.
 *
 * Uses the me.memberships tRPC query to determine the user's role
 * for the current tenant, including department scoping for staff.
 */
"use client";

import { trpc } from "@/lib/trpc";
import { useTenant } from "./use-tenant";

export function useRole() {
  const { tenantId } = useTenant();
  const { data: memberships } = trpc.me.memberships.useQuery();

  // Prefer global (tech_admin) membership over tenant-scoped ones
  const globalMembership = memberships?.find((m) => m.tenantId === null);
  const tenantMembership = memberships?.find((m) => m.tenantId === tenantId);
  const membership = globalMembership ?? tenantMembership;

  const roleName = membership?.roleName ?? null;

  return {
    role: roleName,
    permissions: membership?.permissions ?? [],
    departmentId: membership?.departmentId ?? null,
    isTechAdmin: roleName === "tech_admin",
    isCityAdmin: roleName === "city_admin",
    isSupervisor: roleName === "supervisor",
    isStaff: roleName === "staff",
    isMember: roleName === "member",
    /** Whether the user can modify conversations (not member). */
    canEdit: roleName !== "member" && roleName !== null,
    /** Whether the user can assign tickets (supervisor+). */
    canAssign: ["tech_admin", "city_admin", "supervisor"].includes(roleName ?? ""),
    /** Whether the user can change SLA/settings (admin only). */
    canAdmin: ["tech_admin", "city_admin"].includes(roleName ?? ""),
  };
}

export function useIsAdmin() {
  const { role } = useRole();
  return role === "tech_admin" || role === "city_admin";
}
