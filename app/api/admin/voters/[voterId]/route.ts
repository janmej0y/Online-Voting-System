import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { serializeVoter } from "@/lib/admin-data";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { sendVoterApprovedEmail, sendVoterRejectedEmail } from "@/lib/mailer";

export async function PATCH(request: Request, context: { params: Promise<{ voterId: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const { voterId } = await context.params;
  const voterRef = adminDb.collection("voters").doc(voterId);
  const existing = await voterRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "Voter not found." }, { status: 404 });
  }
  const existingData = existing.data() || {};

  const body = (await request.json().catch(() => null)) as
    | {
        status?: "pending" | "approved" | "rejected";
        constituencyId?: string;
        eligibleElectionIds?: string[];
        role?: "voter" | "reviewer" | "admin";
        verificationStatus?: "unsubmitted" | "submitted" | "under_review" | "approved" | "rejected";
        verificationNotes?: string;
      }
    | null;

  await voterRef.set(
    {
      ...(typeof body?.status === "string" ? { status: body.status } : {}),
      ...(typeof body?.constituencyId === "string" ? { constituencyId: body.constituencyId } : {}),
      ...(Array.isArray(body?.eligibleElectionIds) ? { eligibleElectionIds: body.eligibleElectionIds } : {}),
      ...(typeof body?.role === "string" ? { role: body.role } : {}),
      ...(typeof body?.verificationStatus === "string" ? { verificationStatus: body.verificationStatus } : {}),
      ...(typeof body?.verificationNotes === "string"
        ? {
            verification: {
              ...(existing.data()?.verification || {}),
              notes: body.verificationNotes,
              reviewedAt: FieldValue.serverTimestamp(),
              reviewedBy: auth.user.email || "borj18237@gmail.com"
            }
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const saved = await voterRef.get();
  const savedData = saved.data() || {};
  const transitionedToApproved =
    savedData.status === "approved" &&
    savedData.verificationStatus === "approved" &&
    (existingData.status !== "approved" || existingData.verificationStatus !== "approved");
  const transitionedToRejected =
    savedData.status === "rejected" &&
    savedData.verificationStatus === "rejected" &&
    (existingData.status !== "rejected" || existingData.verificationStatus !== "rejected");

  if (transitionedToApproved && typeof savedData.email === "string" && savedData.email) {
    void sendVoterApprovedEmail({
      voterEmail: savedData.email,
      voterName: typeof savedData.displayName === "string" ? savedData.displayName : "",
      constituencyId: typeof savedData.constituencyId === "string" ? savedData.constituencyId : ""
    }).catch(() => null);
  }
  if (transitionedToRejected && typeof savedData.email === "string" && savedData.email) {
    const rejectionReason =
      typeof savedData.verification?.notes === "string" && savedData.verification.notes.trim()
        ? savedData.verification.notes
        : body?.verificationNotes || "The submitted profile or documents need correction before approval.";

    void sendVoterRejectedEmail({
      voterEmail: savedData.email,
      voterName: typeof savedData.displayName === "string" ? savedData.displayName : "",
      reason: rejectionReason
    }).catch(() => null);
  }
  return NextResponse.json({ voter: serializeVoter(saved.id, savedData) });
}
