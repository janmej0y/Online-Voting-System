import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

import { getFirebaseAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import type { UserRole } from "@/lib/election-data";

export const ADMIN_EMAIL = "borj18237@gmail.com";
export const ADMIN_MFA_COOKIE = "ezeevote-admin-mfa";
const ADMIN_MFA_SECRET = process.env.ADMIN_PANEL_OTP || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

export type VerifiedAdminUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
  isAdmin: boolean;
};

export function isAdminSecondFactorRequired() {
  return Boolean(ADMIN_MFA_SECRET && JWT_SECRET);
}

async function readAdminMfaCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_MFA_COOKIE}=`));

  if (!match || !JWT_SECRET) return null;
  const token = decodeURIComponent(match.slice(`${ADMIN_MFA_COOKIE}=`.length));
  const payload = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET)).catch(() => null);
  return payload?.payload || null;
}

export async function isAdminSecondFactorVerified(request: Request, email: string | null) {
  if (!isAdminSecondFactorRequired() || email !== ADMIN_EMAIL) return true;
  const payload = await readAdminMfaCookie(request);
  return payload?.sub === email && payload.scope === "admin-mfa";
}

export async function issueAdminMfaToken(email: string) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return new SignJWT({ scope: "admin-mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

export function getAdminSecondFactorCode() {
  return ADMIN_MFA_SECRET || null;
}

async function readBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function verifyRequestUser(request: Request): Promise<VerifiedAdminUser | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const idToken = await readBearerToken(request);
  if (!idToken) return null;

  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) return null;

  const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
  if (!decoded?.uid) return null;

  const email = typeof decoded.email === "string" ? decoded.email : null;
  const normalizedEmail = email?.toLowerCase() || null;
  const isAdmin = normalizedEmail === ADMIN_EMAIL;

  return {
    uid: decoded.uid,
    email: normalizedEmail,
    emailVerified: Boolean(decoded.email_verified),
    role: isAdmin ? "admin" : "voter",
    isAdmin
  };
}

export async function requireAdmin(request: Request) {
  const user = await verifyRequestUser(request);

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  if (!user.isAdmin) {
    return { error: NextResponse.json({ error: "Admin access is restricted." }, { status: 403 }) };
  }

  const mfaVerified = await isAdminSecondFactorVerified(request, user.email);
  if (!mfaVerified) {
    return { error: NextResponse.json({ error: "Admin second-factor verification is required." }, { status: 403 }) };
  }

  return { user };
}
