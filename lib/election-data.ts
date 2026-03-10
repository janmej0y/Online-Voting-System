export type StatTone = "primary" | "accent";
export type ElectionStatus = "draft" | "scheduled" | "active" | "paused" | "closed" | "certified";
export type VoterStatus = "pending" | "approved" | "rejected";
export type UserRole = "voter" | "reviewer" | "admin";
export type VerificationStatus = "unsubmitted" | "submitted" | "under_review" | "approved" | "rejected";

export type Stat = {
  label: string;
  value: string;
  change: string;
  tone: StatTone;
};

export type Candidate = {
  id: string;
  name: string;
  party: string;
  percentage: number;
  votes: number;
  image: string;
  symbol: string;
  constituencyId?: string | null;
  manifestoUrl?: string | null;
  bio?: string | null;
  order?: number;
};

export type AdminTask = {
  title: string;
  description: string;
  status: string;
};

export type LiveFeedRow = {
  region: string;
  turnout: number;
  ballots: number;
};

export type Election = {
  id: string;
  title: string;
  description: string;
  rules?: string;
  status: ElectionStatus;
  allowVoting: boolean;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type DashboardData = {
  stats: Stat[];
  candidates: Candidate[];
  adminTasks: AdminTask[];
  liveFeed: LiveFeedRow[];
  election: Election | null;
  updatedAt?: string | null;
};

export type VoterRecord = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  profileImageDataUrl?: string | null;
  role: UserRole;
  status: VoterStatus;
  constituencyId: string;
  eligibleElectionIds: string[];
  emailVerified: boolean;
  verificationStatus?: VerificationStatus;
  verification?: {
    documentType: string;
    documentNumberMasked: string;
    documentUrl: string;
    aadhaarMasked?: string | null;
    voterIdMasked?: string | null;
    selfieImageDataUrl?: string | null;
    addressProofUrl?: string | null;
    notes?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    reviewedBy?: string | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminSession = {
  email: string | null;
  isAdmin: boolean;
  role: UserRole;
};

export const stats: Stat[] = [
  { label: "Total Voters", value: "248,920", change: "+4.2% verified", tone: "primary" },
  { label: "Votes Cast", value: "201,488", change: "+1,240 in the last hour", tone: "accent" },
  { label: "Turnout %", value: "80.9%", change: "Ahead of target by 6.4%", tone: "primary" },
  { label: "Active Elections", value: "12", change: "3 nationwide, 9 regional", tone: "accent" }
];

export const candidates: Candidate[] = [
  {
    id: "cand-1",
    name: "Narendra Modi",
    party: "Bharatiya Janata Party",
    percentage: 38,
    votes: 76534,
    image: "/assets/Leaders/modi.jpg",
    symbol: "/assets/party-symbols/bjp.png",
    constituencyId: "north-district",
    order: 1
  },
  {
    id: "cand-2",
    name: "Rahul Gandhi",
    party: "Indian National Congress",
    percentage: 29,
    votes: 58431,
    image: "/assets/Leaders/rahul.jpg",
    symbol: "/assets/party-symbols/Congress.png",
    constituencyId: "central-metro",
    order: 2
  },
  {
    id: "cand-3",
    name: "Mamata Banerjee",
    party: "All India Trinamool Congress",
    percentage: 21,
    votes: 42312,
    image: "/assets/Leaders/mamata.jpg",
    symbol: "/assets/party-symbols/tmc.png",
    constituencyId: "river-belt",
    order: 3
  },
  {
    id: "cand-4",
    name: "Arvind Kejriwal",
    party: "Aam Aadmi Party",
    percentage: 12,
    votes: 24211,
    image: "/assets/Leaders/kejriwal.jpg",
    symbol: "/assets/party-symbols/aam_aadmi.png",
    constituencyId: "coastal-zone",
    order: 4
  }
];

export const adminTasks: AdminTask[] = [
  {
    title: "Manage Elections",
    description: "Create, publish, pause, and close election cycles with auditable state changes.",
    status: "12 active boards"
  },
  {
    title: "Verify Voters",
    description: "Review identity checks, flag exceptions, and approve secure access before ballots open.",
    status: "1,824 pending reviews"
  },
  {
    title: "Monitor Vote Count",
    description: "Watch live counting feeds, anomaly alerts, and turnout movement across constituencies.",
    status: "Realtime sync online"
  }
];

export const liveFeedSeed: LiveFeedRow[] = [
  { region: "North District", turnout: 84, ballots: 42318 },
  { region: "Central Metro", turnout: 79, ballots: 58802 },
  { region: "River Belt", turnout: 76, ballots: 31742 },
  { region: "Coastal Zone", turnout: 82, ballots: 40611 }
];

export const fallbackDashboardData: DashboardData = {
  stats,
  candidates,
  adminTasks,
  liveFeed: liveFeedSeed,
  election: {
    id: "lok-sabha-2026",
    title: "National Election 2026",
    description: "Fallback dashboard snapshot used when Firestore is not configured.",
    rules: "One verified voter may cast one final ballot during the active window.",
    status: "active",
    allowVoting: true,
    isActive: true,
    startsAt: null,
    endsAt: null
  },
  updatedAt: null
};
