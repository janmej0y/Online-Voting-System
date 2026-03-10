import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { serializeVoter } from "@/lib/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import type { UserRole, VoterStatus } from "@/lib/election-data";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const snapshots = await adminDb.collection("voters").orderBy("updatedAt", "desc").get();
  return NextResponse.json({
    voters: snapshots.docs.map((doc) => serializeVoter(doc.id, doc.data()))
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        uid?: string;
        email?: string;
        displayName?: string;
        constituencyId?: string;
        status?: VoterStatus;
        role?: UserRole;
        eligibleElectionIds?: string[];
        emailVerified?: boolean;
      }
    | null;

  if (!body?.uid || !body?.email) {
    return NextResponse.json({ error: "Voter uid and email are required." }, { status: 400 });
  }

  const voterRef = adminDb.collection("voters").doc(body.uid);
  const existing = await voterRef.get();

  await voterRef.set(
    {
      uid: body.uid,
      email: body.email.toLowerCase(),
      displayName: body.displayName || "",
      constituencyId: body.constituencyId || "",
      status: body.status || "pending",
      role: body.role || "voter",
      eligibleElectionIds: Array.isArray(body.eligibleElectionIds) ? body.eligibleElectionIds : [],
      emailVerified: Boolean(body.emailVerified),
      createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const saved = await voterRef.get();
  return NextResponse.json({ voter: serializeVoter(saved.id, saved.data()) });
}
