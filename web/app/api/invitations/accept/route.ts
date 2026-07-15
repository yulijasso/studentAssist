/**
 * POST /api/invitations/accept — accepts an invitation token.
 *
 * Creates the user record if needed, creates the membership,
 * marks the invitation as accepted, and returns the redirect URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { env } from "@/server/config";
import { tenantMemberships } from "@/server/db/schema";
import { getInvitationByToken, acceptInvitation } from "@/server/services/invitation_service";
import { getOrCreateUser } from "@/server/services/user_service";
import {
  createMembership,
  invalidateUserContext,
} from "@/server/services/membership_service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email: bodyEmail, name: bodyName } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify Clerk JWT
    let clerkId: string | null = null;
    let email: string | null = bodyEmail ?? null;
    let name: string | null = bodyName ?? null;

    if (!env.CLERK_SECRET_KEY) {
      clerkId = "dev_user";
      email = email ?? "dev@localhost";
      name = name ?? "Dev User";
    } else {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const jwt = authHeader.slice(7);
      try {
        const { verifyToken } = await import("@clerk/nextjs/server");
        const payload = await verifyToken(jwt, { secretKey: env.CLERK_SECRET_KEY });
        if (!payload?.sub) {
          return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }
        clerkId = payload.sub;

        // Get email/name from Clerk if not provided in body
        if (!email || !name) {
          try {
            const { clerkClient } = await import("@clerk/nextjs/server");
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(payload.sub);
            email = email ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
            name = name ?? ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null);
          } catch {
            // Fallback — email will come from invitation
          }
        }
      } catch {
        return NextResponse.json({ error: "JWT verification failed" }, { status: 401 });
      }
    }

    // Look up invitation
    const invitation = await getInvitationByToken(db, token);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 400 });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
    }

    // Enforce: signed-in email must match invitation email
    if (email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Signed-in email does not match invitation. Please sign out and use the correct account." },
        { status: 403 },
      );
    }

    // Use the invitation email as the source of truth
    const user = await getOrCreateUser(db, clerkId!, invitation.email, name);

    // Check if user already has a membership for this tenant
    const existingConditions = [eq(tenantMemberships.userId, user.id)];
    if (invitation.tenantId) {
      existingConditions.push(eq(tenantMemberships.tenantId, invitation.tenantId));
    }
    const [existingMembership] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(...existingConditions))
      .limit(1);

    if (existingMembership) {
      // Update existing membership with new role and department instead of creating duplicate
      await db
        .update(tenantMemberships)
        .set({ roleId: invitation.roleId, departmentId: invitation.departmentId ?? null, isActive: true })
        .where(eq(tenantMemberships.id, existingMembership.id));
    } else {
      await createMembership(db, {
        userId: user.id,
        tenantId: invitation.tenantId,
        roleId: invitation.roleId,
        departmentId: invitation.departmentId ?? null,
        invitedBy: invitation.invitedBy,
      });
    }

    // Mark invitation accepted
    await acceptInvitation(db, invitation.id);

    // Invalidate cached context
    const redis = getRedis();
    await invalidateUserContext(redis, clerkId!);

    // Determine redirect
    const redirectUrl =
      invitation.roleName === "tech_admin"
        ? "/admin"
        : invitation.tenantSlug
          ? `/dashboard/${invitation.tenantSlug}/conversations`
          : "/";

    return NextResponse.json({ success: true, redirectUrl });
  } catch (err) {
    console.error("[invite/accept] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
