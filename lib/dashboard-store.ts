import {
  doc,
  onSnapshot,
  type DocumentData,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";

import {
  fallbackDashboardData,
  type AdminTask,
  type Candidate,
  type DashboardData,
  type Election,
  type ElectionStatus,
  type LiveFeedRow,
  type Stat
} from "@/lib/election-data";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeStatus(value: unknown): ElectionStatus {
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

function normalizeStats(input: unknown): Stat[] {
  if (!Array.isArray(input)) return fallbackDashboardData.stats;
  return input.map((item, index) => {
    const source = typeof item === "object" && item ? item : {};
    return {
      label: toString((source as { label?: unknown }).label, fallbackDashboardData.stats[index]?.label || "Stat"),
      value: toString((source as { value?: unknown }).value, "0"),
      change: toString((source as { change?: unknown }).change, ""),
      tone: (source as { tone?: "primary" | "accent" }).tone === "accent" ? "accent" : "primary"
    };
  });
}

function normalizeCandidates(input: unknown): Candidate[] {
  if (!Array.isArray(input)) return fallbackDashboardData.candidates;
  return input
    .map((item, index) => {
      const source = typeof item === "object" && item ? item : {};
      return {
        id: toString((source as { id?: unknown }).id, fallbackDashboardData.candidates[index]?.id || `candidate-${index + 1}`),
        name: toString((source as { name?: unknown }).name, "Candidate"),
        party: toString((source as { party?: unknown }).party, "Independent"),
        percentage: toNumber((source as { percentage?: unknown }).percentage, 0),
        votes: toNumber((source as { votes?: unknown }).votes, 0),
        image: toString((source as { image?: unknown }).image, fallbackDashboardData.candidates[index]?.image || ""),
        symbol: toString((source as { symbol?: unknown }).symbol, fallbackDashboardData.candidates[index]?.symbol || ""),
        constituencyId: toNullableString((source as { constituencyId?: unknown }).constituencyId),
        manifestoUrl: toNullableString((source as { manifestoUrl?: unknown }).manifestoUrl),
        bio: toNullableString((source as { bio?: unknown }).bio),
        order: toNumber((source as { order?: unknown }).order, index + 1)
      };
    })
    .sort((left, right) => (left.order || 0) - (right.order || 0));
}

function normalizeAdminTasks(input: unknown): AdminTask[] {
  if (!Array.isArray(input)) return fallbackDashboardData.adminTasks;
  return input.map((item, index) => {
    const source = typeof item === "object" && item ? item : {};
    return {
      title: toString((source as { title?: unknown }).title, fallbackDashboardData.adminTasks[index]?.title || "Task"),
      description: toString((source as { description?: unknown }).description, ""),
      status: toString((source as { status?: unknown }).status, "")
    };
  });
}

function normalizeLiveFeed(input: unknown): LiveFeedRow[] {
  if (!Array.isArray(input)) return fallbackDashboardData.liveFeed;
  return input.map((item, index) => {
    const source = typeof item === "object" && item ? item : {};
    return {
      region: toString((source as { region?: unknown }).region, fallbackDashboardData.liveFeed[index]?.region || "Region"),
      turnout: toNumber((source as { turnout?: unknown }).turnout, 0),
      ballots: toNumber((source as { ballots?: unknown }).ballots, 0)
    };
  });
}

function normalizeElection(source: Record<string, unknown>, fallbackId?: string): Election {
  return {
    id: toString(source.id, fallbackId || fallbackDashboardData.election?.id || "active-election"),
    title: toString(source.title, fallbackDashboardData.election?.title || "Election"),
    description: toString(source.description, fallbackDashboardData.election?.description || ""),
    status: normalizeStatus(source.status),
    allowVoting: typeof source.allowVoting === "boolean" ? source.allowVoting : true,
    isActive: typeof source.isActive === "boolean" ? source.isActive : false,
    startsAt: toNullableString(source.startsAt),
    endsAt: toNullableString(source.endsAt)
  };
}

function normalizeElectionDashboard(source: Record<string, unknown>, electionId: string): DashboardData {
  return {
    stats: normalizeStats(source.stats),
    candidates: normalizeCandidates(source.candidates),
    adminTasks: normalizeAdminTasks(source.adminTasks),
    liveFeed: normalizeLiveFeed(source.liveFeed),
    election: normalizeElection(source, electionId),
    updatedAt: toNullableString(source.updatedAt)
  };
}

function readConfig(data: DocumentData | undefined) {
  if (!data || typeof data !== "object") return null;
  const activeElectionId = toNullableString((data as { activeElectionId?: unknown }).activeElectionId);
  return activeElectionId;
}

export function subscribeDashboardData(
  db: Firestore,
  onData: (data: DashboardData) => void,
  onError: (error: Error) => void
): Unsubscribe {
  let electionUnsubscribe: Unsubscribe | null = null;

  const configUnsubscribe = onSnapshot(
    doc(db, "system", "public"),
    (configSnapshot) => {
      const activeElectionId = readConfig(configSnapshot.data());

      if (electionUnsubscribe) {
        electionUnsubscribe();
        electionUnsubscribe = null;
      }

      if (!activeElectionId) {
        onData(fallbackDashboardData);
        return;
      }

      electionUnsubscribe = onSnapshot(
        doc(db, "elections", activeElectionId),
        (electionSnapshot) => {
          if (!electionSnapshot.exists()) {
            onData(fallbackDashboardData);
            return;
          }

          onData(normalizeElectionDashboard(electionSnapshot.data() as Record<string, unknown>, activeElectionId));
        },
        (error) => onError(error)
      );
    },
    (error) => onError(error)
  );

  return () => {
    if (electionUnsubscribe) electionUnsubscribe();
    configUnsubscribe();
  };
}
