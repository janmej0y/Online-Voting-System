import { NextResponse } from "next/server";

import {
  ADMIN_MFA_COOKIE,
  getAdminSecondFactorCode,
  issueAdminMfaToken,
  verifyRequestUser
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin access is restricted." }, { status: 403 });
  }

  const configuredCode = getAdminSecondFactorCode();
  if (!configuredCode) {
    return NextResponse.json({ verified: true, skipped: true });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code || body.code !== configuredCode) {
    return NextResponse.json({ error: "Invalid admin verification code." }, { status: 400 });
  }

  const token = await issueAdminMfaToken(user.email || "");
  const response = NextResponse.json({ verified: true });
  response.cookies.set(ADMIN_MFA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ cleared: true });
  response.cookies.set(ADMIN_MFA_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
