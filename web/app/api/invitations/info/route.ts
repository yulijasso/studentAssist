import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getInvitationByToken } from "@/server/services/invitation_service";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

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

  return NextResponse.json({
    email: invitation.email,
    roleName: invitation.roleName,
    tenantName: invitation.tenantName,
  });
}
