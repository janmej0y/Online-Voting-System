import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { serializeElection } from "@/lib/admin-data";
import { syncElectionSchedules } from "@/lib/election-automation";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import type { Candidate } from "@/lib/election-data";

function normalizeCandidate(candidate: Partial<Candidate>, index: number): Candidate {
  return {
    id: candidate.id || `candidate-${index + 1}`,
    name: candidate.name || "Candidate",
    party: candidate.party || "Independent",
    percentage: typeof candidate.percentage === "number" ? candidate.percentage : 0,
    votes: typeof candidate.votes === "number" ? candidate.votes : 0,
    image: candidate.image || "",
    symbol: candidate.symbol || "",
    constituencyId: candidate.constituencyId || "",
    manifestoUrl: candidate.manifestoUrl || "",
    bio: candidate.bio || "",
    order: typeof candidate.order === "number" ? candidate.order : index + 1
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ electionId: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  await syncElectionSchedules();

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const { electionId } = await context.params;
  const electionRef = adminDb.collection("elections").doc(electionId);
  const existing = await electionRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        rules?: string;
        startsAt?: string | null;
        endsAt?: string | null;
        status?: string;
        allowVoting?: boolean;
        makeActive?: boolean;
        candidates?: Candidate[];
      }
    | null;

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.description === "string") patch.description = body.description;
  if (typeof body?.rules === "string") patch.rules = body.rules;
  if (typeof body?.startsAt === "string" || body?.startsAt === null) patch.startsAt = body.startsAt;
  if (typeof body?.endsAt === "string" || body?.endsAt === null) patch.endsAt = body.endsAt;
  if (typeof body?.status === "string") patch.status = body.status;
  if (typeof body?.allowVoting === "boolean") patch.allowVoting = body.allowVoting;
  if (Array.isArray(body?.candidates)) {
    patch.candidates = body.candidates.map((candidate, index) => normalizeCandidate(candidate, index));
  }

  await electionRef.set(patch, { merge: true });

  if (body?.makeActive) {
    const systemRef = adminDb.collection("system").doc("public");
    const batch = adminDb.batch();
    const elections = await adminDb.collection("elections").get();
    elections.docs.forEach((doc) => {
      batch.set(doc.ref, { isActive: doc.id === electionId }, { merge: true });
    });
    batch.set(systemRef, { activeElectionId: electionId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  const saved = await electionRef.get();
  return NextResponse.json({ election: serializeElection(saved.data(), saved.id) });
}
