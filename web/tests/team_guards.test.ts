/**
 * Security-boundary tests for the tenant-scoped team router guards.
 *
 * These directly exercise the guard functions that back Issue #2's acceptance
 * criteria: tenant isolation (a city_admin only ever touches their own tenant),
 * no privilege escalation (a city_admin cannot grant tech_admin), protected
 * admins, and unchanged tech_admin behavior.
 */
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  resolveTenantId,
  assertSameTenant,
  assertRoleGrantable,
  isProtectedAdmin,
  NON_GRANTABLE_ROLES,
  PROTECTED_ADMINS,
} from "@/server/trpc/guards";

/** Builds a mock drizzle db whose select().from().where().limit() resolves to `rows`. */
function mockDbReturning(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => chain } as never;
}

/** Captures the TRPCError thrown by `fn`, or returns null if it did not throw. */
async function catchTRPC(fn: () => unknown): Promise<TRPCError | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e as TRPCError;
  }
}

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

// ── resolveTenantId: tenant isolation ─────────────────────────────────────────

describe("resolveTenantId", () => {
  it("lets a city_admin act on their own tenant", () => {
    const ctx = { role: "city_admin", userTenantId: TENANT_A };
    expect(resolveTenantId(ctx, TENANT_A)).toBe(TENANT_A);
  });

  it("rejects a city_admin acting on a different tenant (cross-tenant, server-verified)", async () => {
    const ctx = { role: "city_admin", userTenantId: TENANT_A };
    const err = await catchTRPC(() => resolveTenantId(ctx, TENANT_B));
    expect(err).toBeInstanceOf(TRPCError);
    expect(err?.code).toBe("FORBIDDEN");
  });

  it("rejects a city_admin with no tenant association", async () => {
    const ctx = { role: "city_admin", userTenantId: null };
    const err = await catchTRPC(() => resolveTenantId(ctx, TENANT_A));
    expect(err?.code).toBe("FORBIDDEN");
  });

  it("lets a tech_admin act on any tenant (behavior unchanged)", () => {
    const ctx = { role: "tech_admin", userTenantId: null };
    expect(resolveTenantId(ctx, TENANT_A)).toBe(TENANT_A);
    expect(resolveTenantId(ctx, TENANT_B)).toBe(TENANT_B);
  });
});

// ── assertSameTenant: membership ownership ────────────────────────────────────

describe("assertSameTenant", () => {
  it("passes when the membership is in the effective tenant", () => {
    expect(() => assertSameTenant(TENANT_A, TENANT_A)).not.toThrow();
  });

  it("rejects mutating a membership in another tenant", async () => {
    const err = await catchTRPC(() => assertSameTenant(TENANT_B, TENANT_A));
    expect(err?.code).toBe("FORBIDDEN");
  });

  it("rejects a global (null-tenant) membership when scoped to a tenant", async () => {
    const err = await catchTRPC(() => assertSameTenant(null, TENANT_A));
    expect(err?.code).toBe("FORBIDDEN");
  });
});

// ── assertRoleGrantable: no privilege escalation ──────────────────────────────

describe("assertRoleGrantable", () => {
  it("allows granting a normal tenant role", async () => {
    const db = mockDbReturning([{ id: "role-staff", name: "staff" }]);
    await expect(assertRoleGrantable(db, "role-staff")).resolves.toEqual({
      id: "role-staff",
      name: "staff",
    });
  });

  it("blocks granting tech_admin (privilege escalation)", async () => {
    const db = mockDbReturning([{ id: "role-tech", name: "tech_admin" }]);
    const err = await catchTRPC(() => assertRoleGrantable(db, "role-tech"));
    expect(err?.code).toBe("FORBIDDEN");
  });

  it("rejects an unknown role id", async () => {
    const db = mockDbReturning([]);
    const err = await catchTRPC(() => assertRoleGrantable(db, "does-not-exist"));
    expect(err?.code).toBe("BAD_REQUEST");
  });

  it("keeps tech_admin in the non-grantable set", () => {
    expect(NON_GRANTABLE_ROLES).toContain("tech_admin");
  });
});

// ── isProtectedAdmin: protected admins carry over ─────────────────────────────

describe("isProtectedAdmin", () => {
  it("protects the configured permanent admins", () => {
    for (const email of PROTECTED_ADMINS) {
      expect(isProtectedAdmin(email)).toBe(true);
    }
  });

  it("matches case-insensitively", () => {
    expect(isProtectedAdmin(PROTECTED_ADMINS[0].toUpperCase())).toBe(true);
  });

  it("does not protect a normal member", () => {
    expect(isProtectedAdmin("someone@example.com")).toBe(false);
  });
});
