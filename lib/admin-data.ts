import { Timestamp, type DocumentData } from "firebase-admin/firestore";

import {
  adminTasks,
  liveFeedSeed,
  stats,
  type Candidate,
  type Election,
  type ElectionStatus,
  type LiveFeedRow,
  type Stat,
  type VerificationStatus,
  type VoterRecord
} from "@/lib/election-data";

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : null;
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeElectionStatus(value: unknown): ElectionStatus {
  switch (value) {
    case "draft":
    case "scheduled":
    case "active":
    case "paused":
    case "closed":
    case "certified":
      return value;
    default:
      return "draft";
  }
}

export function createDefaultElection(id: string, title: string) {
  return {
    id,
    title,
    description: "",
    rules: "",
    status: "draft" as ElectionStatus,
    allowVoting: false,
    isActive: false,
    startsAt: null,
    endsAt: null,
    stats,
    adminTasks,
    liveFeed: liveFeedSeed,
    candidates: [] as Candidate[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function serializeStats(value: unknown): Stat[] {
  return Array.isArray(value) ? (value as Stat[]) : stats;
}

export function serializeFeed(value: unknown): LiveFeedRow[] {
  return Array.isArray(value) ? (value as LiveFeedRow[]) : liveFeedSeed;
}

export function serializeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const source = typeof item === "object" && item ? (item as Record<string, unknown>) : {};
    return {
      id: toString(source.id, `candidate-${index + 1}`),
      name: toString(source.name, "Candidate"),
      party: toString(source.party, "Independent"),
      percentage: toNumber(source.percentage, 0),
      votes: toNumber(source.votes, 0),
      image: toString(source.image),
      symbol: toString(source.symbol),
      constituencyId: toString(source.constituencyId),
      manifestoUrl: toString(source.manifestoUrl),
      bio: toString(source.bio),
      order: toNumber(source.order, index + 1)
    };
  });
}

export function serializeElection(data: DocumentData | undefined, fallbackId?: string): Election & {
  createdAt?: string | null;
  updatedAt?: string | null;
  candidates: Candidate[];
  stats: Stat[];
  liveFeed: LiveFeedRow[];
} {
  const source = (data || {}) as Record<string, unknown>;
  return {
    id: toString(source.id, fallbackId || "election"),
    title: toString(source.title, "Election"),
    description: toString(source.description),
    rules: toString(source.rules),
    status: normalizeElectionStatus(source.status),
    allowVoting: toBoolean(source.allowVoting, false),
    isActive: toBoolean(source.isActive, false),
    startsAt: toIso(source.startsAt),
    endsAt: toIso(source.endsAt),
    createdAt: toIso(source.createdAt),
    updatedAt: toIso(source.updatedAt),
    candidates: serializeCandidates(source.candidates),
    stats: serializeStats(source.stats),
    liveFeed: serializeFeed(source.liveFeed)
  };
}

export function serializeVoter(id: string, data: DocumentData | undefined): VoterRecord {
  const source = (data || {}) as Record<string, unknown>;
  const verificationSource =
    typeof source.verification === "object" && source.verification ? (source.verification as Record<string, unknown>) : null;
  const verificationStatus = (() => {
    switch (source.verificationStatus) {
      case "submitted":
      case "under_review":
      case "approved":
      case "rejected":
        return source.verificationStatus;
      default:
        return "unsubmitted";
    }
  })() as VerificationStatus;

  return {
    uid: toString(source.uid, id),
    email: toString(source.email),
    displayName: toString(source.displayName),
    phone: toString(source.phone),
    dateOfBirth: toString(source.dateOfBirth),
    addressLine1: toString(source.addressLine1),
    addressLine2: toString(source.addressLine2),
    city: toString(source.city),
    state: toString(source.state),
    postalCode: toString(source.postalCode),
    country: toString(source.country),
    profileImageDataUrl: toString(source.profileImageDataUrl) || null,
    role: source.role === "admin" || source.role === "reviewer" ? source.role : "voter",
    status: source.status === "approved" || source.status === "rejected" ? source.status : "pending",
    constituencyId: toString(source.constituencyId),
    eligibleElectionIds: toStringArray(source.eligibleElectionIds),
    emailVerified: toBoolean(source.emailVerified, false),
    verificationStatus,
    verification: verificationSource
      ? {
          documentType: toString(verificationSource.documentType),
          documentNumberMasked: toString(verificationSource.documentNumberMasked),
          documentUrl: toString(verificationSource.documentUrl),
          aadhaarMasked: toString(verificationSource.aadhaarMasked) || null,
          voterIdMasked: toString(verificationSource.voterIdMasked) || null,
          selfieImageDataUrl: toString(verificationSource.selfieImageDataUrl) || null,
          addressProofUrl: toString(verificationSource.addressProofUrl) || null,
          notes: toString(verificationSource.notes) || null,
          submittedAt: toIso(verificationSource.submittedAt),
          reviewedAt: toIso(verificationSource.reviewedAt),
          reviewedBy: toString(verificationSource.reviewedBy) || null
        }
      : null,
    createdAt: toIso(source.createdAt),
    updatedAt: toIso(source.updatedAt)
  };
}
