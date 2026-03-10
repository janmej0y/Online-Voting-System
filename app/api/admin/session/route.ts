import { NextResponse } from "next/server";

import { ADMIN_EMAIL, isAdminSecondFactorRequired, isAdminSecondFactorVerified, verifyRequestUser } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  const mfaVerified = await isAdminSecondFactorVerified(request, user?.email || null);

  return NextResponse.json({
    email: user?.email || null,
    isAdmin: Boolean(user?.isAdmin),
    role: user?.role || "voter",
    adminEmail: ADMIN_EMAIL,
    mfaRequired: isAdminSecondFactorRequired() && Boolean(user?.isAdmin),
    mfaVerified
  });
}
