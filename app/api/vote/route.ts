import { FieldValue } from "firebase-admin/firestore";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { syncElectionSchedules } from "@/lib/election-automation";
import { fallbackDashboardData } from "@/lib/election-data";
import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase-admin";

const secret = process.env.JWT_SECRET;

function getElectionOpenState(election: { allowVoting?: boolean; status?: string }) {
  const status = election.status || "draft";
  return election.allowVoting !== false && (status === "active" || status === "scheduled");
}

async function ensureElectionExists(adminDb: NonNullable<ReturnType<typeof getFirebaseAdminDb>>, electionId: string) {
  const electionRef = adminDb.collection("elections").doc(electionId);
  const electionSnap = await electionRef.get();
  if (electionSnap.exists) return;

  const fallbackElection = fallbackDashboardData.election;
  if (!fallbackElection || electionId !== fallbackElection.id) return;

  await electionRef.set(
    {
      ...fallbackElection,
      stats: fallbackDashboardData.stats,
      candidates: fallbackDashboardData.candidates,
      adminTasks: fallbackDashboardData.adminTasks,
      liveFeed: fallbackDashboardData.liveFeed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  await adminDb
    .collection("system")
    .doc("public")
    .set(
      {
        activeElectionId: electionId,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

export async function POST(request: Request) {
  if (!secret) {
    return NextResponse.json({ error: "JWT_SECRET is not configured." }, { status: 500 });
  }
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Firebase Admin credentials are not configured." }, { status: 500 });
  }

  await syncElectionSchedules();

  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 401 });
  }

  const adminAuth = getFirebaseAdminAuth();
  const adminDb = getFirebaseAdminDb();
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken).catch(() => null);
  if (!decodedToken?.uid) {
    return NextResponse.json({ error: "Invalid Firebase ID token." }, { status: 401 });
  }
  if (!decodedToken.email_verified && decodedToken.firebase?.sign_in_provider !== "google.com") {
    return NextResponse.json({ error: "Email verification is required before voting." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        electionId?: string;
        candidateId?: string;
        candidateName?: string;
      }
    | null;

  if (!body?.candidateId || !body?.candidateName) {
    return NextResponse.json({ error: "Missing vote payload." }, { status: 400 });
  }

  const systemRef = adminDb.collection("system").doc("public");
  const auditRef = adminDb.collection("auditLogs").doc();

  let electionId = body.electionId || "active-election";
  let votedAtIso = new Date().toISOString();
  const systemSnap = await systemRef.get();
  const configuredElectionId = systemSnap.data()?.activeElectionId;
  electionId = typeof configuredElectionId === "string" ? configuredElectionId : electionId;
  await ensureElectionExists(adminDb, electionId);

  const transactionResult = await adminDb
    .runTransaction(async (transaction) => {
      const electionRef = adminDb.collection("elections").doc(electionId);
      const voteRef = adminDb.collection("votes").doc(`${electionId}_${decodedToken.uid}`);
      const voterRef = adminDb.collection("voters").doc(decodedToken.uid);

      const [electionSnap, existingVoteSnap, voterSnap] = await Promise.all([
        transaction.get(electionRef),
        transaction.get(voteRef),
        transaction.get(voterRef)
      ]);

      if (!electionSnap.exists) {
        throw new Error("Active election not found.");
      }

      const electionData = (electionSnap.data() || {}) as {
        candidates?: Array<Record<string, unknown>>;
        stats?: Array<Record<string, unknown>>;
        liveFeed?: Array<Record<string, unknown>>;
        title?: string;
        allowVoting?: boolean;
        status?: string;
      };

      const canVote = getElectionOpenState(electionData);
      if (!canVote) {
        throw new Error("Voting is currently closed for this election.");
      }
      if (existingVoteSnap.exists) {
        throw new Error("You have already voted in this election.");
      }

      const voterData = (voterSnap.data() || {}) as {
        status?: string;
        role?: string;
        constituencyId?: string;
        eligibleElectionIds?: unknown;
        verificationStatus?: string;
      };

      if (voterData.status !== "approved" || voterData.verificationStatus !== "approved") {
        throw new Error("Your voter profile is not approved yet.");
      }

      const eligibleElectionIds = Array.isArray(voterData.eligibleElectionIds)
        ? voterData.eligibleElectionIds.filter((item): item is string => typeof item === "string")
        : [];
      if (eligibleElectionIds.length > 0 && !eligibleElectionIds.includes(electionId)) {
        throw new Error("You are not eligible for this election.");
      }

      const candidates = Array.isArray(electionData.candidates) ? [...electionData.candidates] : [];
      const candidateIndex = candidates.findIndex((candidate) => candidate.id === body.candidateId);

      if (candidateIndex < 0) {
        throw new Error("Candidate not found in the active election.");
      }

      const selectedCandidate = candidates[candidateIndex];
      const candidateConstituency =
        typeof selectedCandidate.constituencyId === "string" ? selectedCandidate.constituencyId : null;
      const voterConstituency = typeof voterData.constituencyId === "string" ? voterData.constituencyId : null;
      const isFallbackElection = electionId === fallbackDashboardData.election?.id;

      if (!isFallbackElection && candidateConstituency && voterConstituency && candidateConstituency !== voterConstituency) {
        throw new Error("This ballot is not assigned to your constituency.");
      }

      const nextCandidates = candidates.map((candidate, index) => {
        const votes = typeof candidate.votes === "number" ? candidate.votes : 0;
        return index === candidateIndex ? { ...candidate, votes: votes + 1 } : candidate;
      });
      const totalVotes = nextCandidates.reduce(
        (sum, candidate) => sum + (typeof candidate.votes === "number" ? candidate.votes : 0),
        0
      );
      const normalizedCandidates = nextCandidates.map((candidate) => ({
        ...candidate,
        percentage:
          totalVotes > 0 && typeof candidate.votes === "number"
            ? Math.round((candidate.votes / totalVotes) * 100)
            : 0
      }));

      const nextStats = Array.isArray(electionData.stats)
        ? electionData.stats.map((stat) =>
            stat.label === "Votes Cast"
              ? {
                  ...stat,
                  value: totalVotes.toLocaleString(),
                  change: "+1 vote just recorded"
                }
              : stat
          )
        : [];

      votedAtIso = new Date().toISOString();

      transaction.set(
        voteRef,
        {
          electionId,
          electionTitle: electionData.title || null,
          userId: decodedToken.uid,
          email: decodedToken.email || null,
          candidateId: body.candidateId,
          candidateName: body.candidateName,
          votedAt: votedAtIso
        },
        { merge: false }
      );

      transaction.set(
        auditRef,
        {
          type: "vote_cast",
          electionId,
          electionTitle: electionData.title || null,
          userId: decodedToken.uid,
          email: decodedToken.email || null,
          candidateId: body.candidateId,
          candidateName: body.candidateName,
          createdAt: FieldValue.serverTimestamp()
        },
        { merge: false }
      );

      transaction.set(
        electionRef,
        {
          candidates: normalizedCandidates,
          stats: nextStats,
          updatedAt: votedAtIso
        },
        { merge: true }
      );

      return { electionId, votedAtIso };
    })
    .catch((error: Error) => ({ error: error.message }));

  if ("error" in transactionResult) {
    const statusMap: Record<string, number> = {
      "You have already voted in this election.": 409,
      "Voting is currently closed for this election.": 403,
      "Your voter profile is not approved yet.": 403,
      "You are not eligible for this election.": 403,
      "This ballot is not assigned to your constituency.": 403,
      "Active election not found.": 404
    };
    return NextResponse.json(
      { error: transactionResult.error },
      { status: statusMap[transactionResult.error] || 400 }
    );
  }

  const token = await new SignJWT({
    sub: decodedToken.uid,
    email: decodedToken.email || null,
    electionId: transactionResult.electionId,
    candidateId: body.candidateId,
    candidateName: body.candidateName,
    votedAt: transactionResult.votedAtIso
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    electionId: transactionResult.electionId,
    votedAt: transactionResult.votedAtIso
  });
}
