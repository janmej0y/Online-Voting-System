import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { syncElectionSchedules } from "@/lib/election-automation";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

type VoteRecord = {
  electionId?: string;
  userId?: string;
  candidateId?: string;
  email?: string | null;
  votedAt?: string;
};

type ElectionRecord = {
  id: string;
  isActive?: boolean;
};

type VoterRecord = {
  id: string;
  status?: string;
  verificationStatus?: string;
  verification?: {
    documentNumberHash?: string;
    aadhaarHash?: string;
    voterIdHash?: string;
  };
};

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  await syncElectionSchedules();

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const [votesSnap, electionsSnap, votersSnap] = await Promise.all([
    adminDb.collection("votes").get(),
    adminDb.collection("elections").get(),
    adminDb.collection("voters").get()
  ]);

  const votes = votesSnap.docs.map((doc) => doc.data() as VoteRecord);
  const elections = electionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ElectionRecord[];
  const voters = votersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as VoterRecord[];

  const totalVotes = votes.length;
  const approvedVoters = voters.filter((voter) => voter.status === "approved").length;
  const pendingVoters = voters.filter((voter) => voter.status === "pending").length;
  const turnout = approvedVoters > 0 ? Math.round((totalVotes / approvedVoters) * 100) : 0;

  const votesByElection = votes.reduce<Record<string, number>>((accumulator, vote) => {
    const key = vote.electionId || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const candidateTallies = votes.reduce<Record<string, number>>((accumulator, vote) => {
    const key = `${vote.electionId || "unknown"}:${vote.candidateId || "unknown"}`;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const duplicateUsers = Object.entries(
    votes.reduce<Record<string, number>>((accumulator, vote) => {
      const key = `${vote.electionId || "unknown"}:${vote.userId || "unknown"}`;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  const duplicateDocuments = Object.entries(
    voters.reduce<Record<string, number>>((accumulator, voter) => {
      const key = voter.verification?.documentNumberHash;
      if (!key) return accumulator;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  const duplicateAadhaar = Object.entries(
    voters.reduce<Record<string, number>>((accumulator, voter) => {
      const key = voter.verification?.aadhaarHash;
      if (!key) return accumulator;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  const duplicateVoterIds = Object.entries(
    voters.reduce<Record<string, number>>((accumulator, voter) => {
      const key = voter.verification?.voterIdHash;
      if (!key) return accumulator;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  const approvedWithoutVerification = voters.filter(
    (voter) => voter.status === "approved" && voter.verificationStatus !== "approved"
  ).length;

  const anomalies = [
    ...(duplicateUsers.length > 0
      ? [{ type: "duplicate_vote_record", severity: "high", count: duplicateUsers.length, detail: "Multiple vote documents detected for the same user and election." }]
      : []),
    ...(pendingVoters > 0
      ? [{ type: "pending_voter_reviews", severity: "medium", count: pendingVoters, detail: "There are voter registrations still waiting for approval." }]
      : []),
    ...(duplicateDocuments.length > 0
      ? [{ type: "duplicate_document_hash", severity: "high", count: duplicateDocuments.length, detail: "Multiple voter profiles share the same identity document fingerprint." }]
      : []),
    ...(duplicateAadhaar.length > 0
      ? [{ type: "duplicate_aadhaar_hash", severity: "high", count: duplicateAadhaar.length, detail: "Multiple voter profiles share the same Aadhaar fingerprint." }]
      : []),
    ...(duplicateVoterIds.length > 0
      ? [{ type: "duplicate_voter_id_hash", severity: "high", count: duplicateVoterIds.length, detail: "Multiple voter profiles share the same voter ID fingerprint." }]
      : []),
    ...(approvedWithoutVerification > 0
      ? [{ type: "approved_without_verification", severity: "medium", count: approvedWithoutVerification, detail: "Some approved voters do not have an approved verification record." }]
      : []),
    ...Object.entries(votesByElection)
      .filter(([, count]) => approvedVoters > 0 && count / approvedVoters > 0.95)
      .map(([electionId, count]) => ({
        type: "high_turnout_spike",
        severity: "medium",
        count,
        detail: `Election ${electionId} is above 95% turnout of approved voters.`
      }))
  ];

  return NextResponse.json({
    summary: {
      totalVotes,
      approvedVoters,
      pendingVoters,
      turnout,
      activeElections: elections.filter((election) => election.isActive).length
    },
    votesByElection,
    candidateTallies,
    anomalies
  });
}
