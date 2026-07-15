/**
 * Plain REST endpoint for listing active tenants (public, read-only).
 * GET /api/tenants
 * Returns [{ slug, name }] for all active tenants, used by the test page dropdown.
 */
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Returns all active tenants as a minimal public list.
 *
 * @returns JSON array of { slug, name } objects.
 */
export async function GET() {
  const rows = await db
    .select({ slug: tenants.slug, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .orderBy(tenants.name);

  return NextResponse.json(rows);
}
