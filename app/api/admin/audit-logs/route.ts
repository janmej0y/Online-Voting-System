import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { syncElectionSchedules } from "@/lib/election-automation";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  await syncElectionSchedules();

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const snapshot = await adminDb.collection("auditLogs").orderBy("createdAt", "desc").limit(50).get();
  return NextResponse.json({
    logs: snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt:
        typeof doc.data().createdAt?.toDate === "function" ? doc.data().createdAt.toDate().toISOString() : null
    }))
  });
}
