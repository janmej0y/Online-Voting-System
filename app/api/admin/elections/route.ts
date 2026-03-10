import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { createDefaultElection, serializeElection } from "@/lib/admin-data";
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

  const [electionSnapshots, systemSnapshot] = await Promise.all([
    adminDb.collection("elections").orderBy("createdAt", "desc").get(),
    adminDb.collection("system").doc("public").get()
  ]);

  const activeElectionId = systemSnapshot.data()?.activeElectionId || null;
  const elections = electionSnapshots.docs.map((doc) => serializeElection(doc.data(), doc.id));

  return NextResponse.json({ elections, activeElectionId });
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
        id?: string;
        title?: string;
        description?: string;
        rules?: string;
        startsAt?: string | null;
        endsAt?: string | null;
        status?: string;
        allowVoting?: boolean;
        makeActive?: boolean;
      }
    | null;

  if (!body?.id || !body?.title) {
    return NextResponse.json({ error: "Election id and title are required." }, { status: 400 });
  }

  const electionRef = adminDb.collection("elections").doc(body.id);
  const existing = await electionRef.get();
  const createdAt = existing.data()?.createdAt || FieldValue.serverTimestamp();
  const base = createDefaultElection(body.id, body.title);

  await electionRef.set(
    {
      ...base,
      description: body.description || base.description,
      rules: body.rules || base.rules,
      startsAt: body.startsAt || null,
      endsAt: body.endsAt || null,
      status: body.status || base.status,
      allowVoting: typeof body.allowVoting === "boolean" ? body.allowVoting : base.allowVoting,
      createdAt,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  if (body.makeActive) {
    const systemRef = adminDb.collection("system").doc("public");
    const batch = adminDb.batch();
    const elections = await adminDb.collection("elections").get();
    elections.docs.forEach((doc) => {
      batch.set(doc.ref, { isActive: doc.id === body.id }, { merge: true });
    });
    batch.set(systemRef, { activeElectionId: body.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  const saved = await electionRef.get();
  return NextResponse.json({ election: serializeElection(saved.data(), saved.id) });
}
