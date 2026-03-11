"use client";

import { AlertTriangle, Clock3, FileBadge2, HelpCircle, ShieldAlert, UserRoundCheck } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ActivityTimeline } from "@/components/activity-timeline";
import { AdminPreview } from "@/components/admin-preview";
import { AuthGuard } from "@/components/auth-guard";
import { CandidatesSection } from "@/components/candidates-section";
import { useAuth } from "@/components/auth-provider";
import { HeroSection } from "@/components/hero-section";
import { LiveResultsSection } from "@/components/live-results-section";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Navbar } from "@/components/navbar";
import { ReceiptVerifier } from "@/components/receipt-verifier";
import { StatsGrid } from "@/components/stats-grid";
import { useToast } from "@/components/toast-provider";
import { VoteProofCard } from "@/components/vote-proof-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeDashboardData } from "@/lib/dashboard-store";
import { fallbackDashboardData, type Candidate, type DashboardData, type VoterRecord } from "@/lib/election-data";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";

type VoteProofState = {
  electionId?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  token?: string | null;
  votedAt?: string | null;
  voterName?: string | null;
  voterEmail?: string | null;
};

const landingCards = [
  { id: "profile", title: "1. Fill profile", detail: "Add your name, phone, age, and constituency.", href: "/profile" },
  { id: "verification", title: "2. Upload proof", detail: "Add ID, address proof, and your photo.", href: "/profile" },
  { id: "vote", title: "3. Vote", detail: "Open the ballot after your profile is approved.", href: "#candidates" },
  { id: "results", title: "4. Results", detail: "See current vote counts and turnout.", href: "#results" },
  { id: "proof", title: "5. Receipt", detail: "Check your receipt token after voting.", href: "#proof" }
] as const;

const reviewCards = [
  {
    name: "Aditi Sharma",
    city: "Kolkata",
    image: "/assets/reviewers/aditi-sharma.svg",
    review: "The profile steps were clear and the proof section made it easy to understand what was recorded after voting."
  },
  {
    name: "Rohan Prasad",
    city: "Patna",
    image: "/assets/reviewers/rohan-prasad.svg",
    review: "The verification flow felt more trustworthy once the status cards and timeline explained what was pending and what was approved."
  },
  {
    name: "Sneha Kulkarni",
    city: "Pune",
    image: "/assets/reviewers/sneha-kulkarni.svg",
    review: "The ballot review and receipt validation made the platform easier to use without needing technical knowledge."
  }
] as const;

function getProfileCompletion(profile: VoterRecord | null) {
  if (!profile) return 0;
  const checks = [
    profile.displayName,
    profile.phone,
    profile.dateOfBirth,
    profile.constituencyId,
    profile.addressLine1,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.profileImageDataUrl,
    profile.verification?.documentUrl,
    profile.verification?.addressProofUrl
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function DashboardShell() {
  const { loading, user } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(fallbackDashboardData);
  const [status, setStatus] = useState<"fallback" | "live" | "error">(isFirebaseConfigured() ? "fallback" : "error");
  const [voterProfile, setVoterProfile] = useState<VoterRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [votedCandidateId, setVotedCandidateId] = useState<string | null>(null);
  const [votePending, setVotePending] = useState(false);
  const [receiptToken, setReceiptToken] = useState<string | null>(null);
  const [voteProof, setVoteProof] = useState<VoteProofState | null>(null);
  const [reviewCandidate, setReviewCandidate] = useState<Candidate | null>(null);
  const [voteBlockedMessage, setVoteBlockedMessage] = useState<string | null>(null);
  const hasGoogleProvider = user?.providerData.some((provider) => provider.providerId === "google.com");
  const isVerifiedAccess = Boolean(user && (user.emailVerified || hasGoogleProvider));
  const profileCompletion = useMemo(() => getProfileCompletion(voterProfile), [voterProfile]);
  const voteStorageKey = useMemo(
    () => (user && data.election?.id ? `ezeevote-vote:${data.election.id}:${user.uid}` : null),
    [data.election?.id, user]
  );
  const electionOpen = data.election?.allowVoting !== false && (data.election?.status || "active") === "active";
  const voterApproved = voterProfile?.status === "approved" && voterProfile?.verificationStatus === "approved";

  useEffect(() => {
    if (!loading && user && !isVerifiedAccess) {
      router.replace("/login");
    }
  }, [isVerifiedAccess, loading, router, user]);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      setVoterProfile(null);
      return;
    }
    const currentUser = user;

    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        const response = await fetch("/api/voter/profile", {
          headers: { Authorization: `Bearer ${await currentUser.getIdToken()}` }
        });
        const payload = (await response.json().catch(() => null)) as { voter?: VoterRecord; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error || "Failed to load profile.");
        if (!cancelled) setVoterProfile(payload?.voter || null);
      } catch (error) {
        if (!cancelled) {
          pushToast({
            tone: "error",
            title: "Profile status unavailable",
            description: error instanceof Error ? error.message : "Failed to load voter profile."
          });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [pushToast, user]);

  useEffect(() => {
    if (!voteStorageKey) {
      setVotedCandidateId(null);
      setReceiptToken(null);
      setVoteProof(null);
      return;
    }

    const storedVote = window.localStorage.getItem(voteStorageKey);
    if (!storedVote) {
      setVotedCandidateId(null);
      setReceiptToken(null);
      setVoteProof(null);
      return;
    }

    try {
      const parsed = JSON.parse(storedVote) as {
        electionId?: string;
        candidateId?: string;
        candidateName?: string;
        token?: string;
        votedAt?: string;
      };
      setVotedCandidateId(parsed.candidateId || null);
      setReceiptToken(typeof parsed.token === "string" ? parsed.token : null);
      setVoteProof({
        electionId: parsed.electionId || data.election?.id || null,
        candidateId: parsed.candidateId || null,
        candidateName: parsed.candidateName || null,
        token: parsed.token || null,
        votedAt: parsed.votedAt || null,
        voterName: user?.displayName || null,
        voterEmail: user?.email || null
      });
    } catch {
      setVotedCandidateId(null);
      setReceiptToken(null);
      setVoteProof(null);
    }
  }, [data.election?.id, user, voteStorageKey]);

  useEffect(() => {
    if (!user || !isVerifiedAccess) return;
    const db = getFirestoreDb();

    if (!db) {
      setStatus("error");
      return;
    }

    const unsubscribe = subscribeDashboardData(
      db,
      (nextData) => {
        setData(nextData);
        setStatus("live");
      },
      () => {
        setData(fallbackDashboardData);
        setStatus("error");
      }
    );

    return unsubscribe;
  }, [isVerifiedAccess, user]);

  function scrollToSection(id: string) {
    if (id === "profile" || id === "verification") {
      router.push("/profile");
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyLocalVote(candidateId: string) {
    setData((current) => {
      const updatedCandidates = current.candidates.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, votes: candidate.votes + 1 } : candidate
      );
      const totalVotes = updatedCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
      const normalizedCandidates = updatedCandidates.map((candidate) => ({
        ...candidate,
        percentage: Math.max(1, Math.round((candidate.votes / totalVotes) * 100))
      }));
      const updatedStats = current.stats.map((stat) =>
        stat.label === "Votes Cast" ? { ...stat, value: totalVotes.toLocaleString(), change: "+1 vote just recorded" } : stat
      );

      return {
        ...current,
        stats: updatedStats,
        candidates: normalizedCandidates,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async function handleVote(candidate: Candidate) {
    if (!user) {
      setVoteBlockedMessage("After completing and verifying your profile, you can vote. Please sign in and finish your profile first.");
      return;
    }
    if (!voterApproved) {
      setVoteBlockedMessage("After completing and verifying your profile, you can vote. Your profile must be approved by the verification desk before ballot access is unlocked.");
      return;
    }
    if (votedCandidateId || votePending || !electionOpen) return;

    setVotePending(true);

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          electionId: data.election?.id,
          candidateId: candidate.id,
          candidateName: candidate.name
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { token?: string; error?: string; electionId?: string; votedAt?: string }
        | null;

      if (!response.ok || !payload?.token) {
        throw new Error(payload?.error || "Vote submission failed.");
      }

      if (voteStorageKey) {
        window.localStorage.setItem(
          voteStorageKey,
          JSON.stringify({
            electionId: payload.electionId || data.election?.id || null,
            candidateId: candidate.id,
            candidateName: candidate.name,
            token: payload.token,
            votedAt: payload.votedAt || new Date().toISOString()
          })
        );
      }

      setVotedCandidateId(candidate.id);
      setReceiptToken(payload.token);
      setVoteProof({
        electionId: payload.electionId || data.election?.id || null,
        candidateId: candidate.id,
        candidateName: candidate.name,
        token: payload.token,
        votedAt: payload.votedAt || new Date().toISOString(),
        voterName: user.displayName || null,
        voterEmail: user.email || null
      });
      applyLocalVote(candidate.id);
      pushToast({
        tone: "success",
        title: "Vote recorded",
        description: `${candidate.name} has been locked as your selection for this election.`
      });
      setReviewCandidate(null);
      scrollToSection("proof");
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Vote submission failed",
        description: error instanceof Error ? error.message : "Vote submission failed."
      });
    } finally {
      setVotePending(false);
    }
  }

  const activityItems = [
    {
      title: "Profile updated",
      detail: voterProfile?.updatedAt ? "Your account record is synchronized with the private desk." : "Profile data has not been updated yet.",
      date: voterProfile?.updatedAt,
      status: `${profileCompletion}% complete`
    },
    {
      title: "Verification submitted",
      detail: voterProfile?.verification?.submittedAt
        ? "Identity and address records were sent for review."
        : "Verification package not submitted yet.",
      date: voterProfile?.verification?.submittedAt,
      status: voterProfile?.verificationStatus || "unsubmitted"
    },
    {
      title: "Verification decision",
      detail: voterProfile?.verification?.reviewedAt
        ? `Reviewed by ${voterProfile.verification?.reviewedBy || "private desk"}.`
        : "No final review decision recorded yet.",
      date: voterProfile?.verification?.reviewedAt,
      status: voterProfile?.status || "pending"
    },
    {
      title: "Vote recorded",
      detail: voteProof?.votedAt ? `Ballot stored for ${voteProof.candidateName || voteProof.candidateId || "selected candidate"}.` : "No ballot recorded yet.",
      date: voteProof?.votedAt,
      status: voteProof?.token ? "receipt issued" : "pending"
    },
    {
      title: "Proof generated",
      detail: voteProof?.token ? "Download and print-ready proof is available." : "Proof will appear after voting.",
      date: voteProof?.votedAt,
      status: voteProof?.token ? "available" : "locked"
    }
  ];

  const cannotVoteReason =
    !voterProfile
      ? "Complete your voter profile and submit verification before voting."
      : voterProfile.verificationStatus === "rejected"
        ? "Your verification was rejected. Update your documents and resubmit from the profile desk."
        : voterProfile.verificationStatus !== "approved"
          ? "Your identity review is still pending. Voting unlocks only after approval."
          : voterProfile.status !== "approved"
            ? "Your voter record has not been approved by the private review desk."
            : !electionOpen
              ? "The active election is not currently open for voting."
              : null;

  return (
    <AuthGuard>
      <main className="min-h-screen overflow-x-hidden pb-24 lg:pb-0">
        <Navbar onCommandScroll={scrollToSection} />
        <div className="container pt-6">
          <Badge className={status === "live" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-600"}>
            {status === "live"
              ? "Connected to Firestore"
              : "Using fallback data until Firebase env and system/public plus elections are configured"}
          </Badge>
          {data.election ? (
            <Badge className="ml-3 bg-secondary text-secondary-foreground">{`${data.election.title} | ${data.election.status}`}</Badge>
          ) : null}
        </div>

        <HeroSection onStartVoting={() => scrollToSection("candidates")} onViewResults={() => scrollToSection("results")} />

        <section className="container py-2">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Register", detail: "Create your account and complete your voter profile." },
              { title: "Verify", detail: "Upload proof documents and wait for admin approval." },
              { title: "Vote", detail: "Once approved, open the ballot and cast your vote." }
            ].map((item) => (
              <Card key={item.title} className="spotlight-card">
                <CardHeader>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Journey</div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.detail}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="container section-divider py-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {landingCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 text-left shadow-soft transition hover:-translate-y-1 hover:border-primary/30 hover:bg-card"
                onClick={() => (card.href.startsWith("#") ? scrollToSection(card.href.slice(1)) : router.push(card.href))}
              >
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Quick route</div>
                <div className="mt-3 text-lg font-semibold">{card.title}</div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</div>
              </button>
            ))}
          </div>
        </section>

        <section id="profile" className="container py-8">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="print-surface">
              <CardHeader>
                <CardTitle>Your profile summary</CardTitle>
                <CardDescription>See what is finished, what is pending, and what to do next.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {profileLoading ? (
                  <>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Profile completion</div>
                          <div className="mt-1 text-3xl font-semibold">{profileCompletion}%</div>
                        </div>
                        <Badge className={voterApproved ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-600"}>
                          {voterProfile?.verificationStatus || "unsubmitted"}
                        </Badge>
                      </div>
                      <Progress className="mt-4" value={profileCompletion} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Constituency</div>
                        <div className="mt-2 font-medium">{voterProfile?.constituencyId || "Not assigned"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/70 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verification desk</div>
                        <div className="mt-2 font-medium">{voterProfile?.status || "pending"}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => router.push("/profile")}>Open profile form</Button>
                      <Button variant="outline" onClick={() => scrollToSection("help")}>
                        Need help?
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <ActivityTimeline items={activityItems} />
          </div>
        </section>

        <section className="container py-2">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { label: "Trust layer", value: "Identity review before ballot access" },
              { label: "Ballot model", value: "One verified voter, one final vote" },
              { label: "After voting", value: "Receipt token and printable proof" }
            ].map((item) => (
              <div key={item.label} className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-soft">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.label}</div>
                <div className="mt-3 text-xl font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        {cannotVoteReason ? (
          <section className="container py-2">
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle>Why voting is locked</CardTitle>
                <CardDescription>You can vote only after your identity and voter details are approved.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-5 text-amber-500" />
                  <span>{cannotVoteReason}</span>
                </div>
                <Button variant="outline" onClick={() => router.push("/profile")}>
                  Fix my profile
                </Button>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <StatsGrid stats={data.stats} />

        <CandidatesSection
          candidates={data.candidates}
          canVote={!votePending && isVerifiedAccess && electionOpen && voterApproved}
          voteHint={cannotVoteReason}
          votedCandidateId={votedCandidateId}
          onVote={(candidate) => {
            if (!voterApproved || !isVerifiedAccess) {
              void handleVote(candidate);
              return;
            }
            setReviewCandidate(candidate);
          }}
        />

        {voteBlockedMessage ? (
          <div className="fixed inset-0 z-[66] bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="mx-auto mt-16 max-w-lg rounded-[2rem] border border-rose-500/30 bg-card/95 p-6 shadow-soft">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                  <AlertTriangle className="size-6" />
                </div>
                <div className="space-y-3">
                  <Badge className="bg-rose-500/10 text-rose-500">Voting locked</Badge>
                  <h2 className="text-2xl font-semibold">You cannot vote yet</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{voteBlockedMessage}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => setVoteBlockedMessage(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setVoteBlockedMessage(null);
                    router.push("/profile");
                  }}
                >
                  Complete profile
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {reviewCandidate ? (
          <div className="fixed inset-0 z-[65] bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="mx-auto mt-12 max-w-xl rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-soft">
              <div className="space-y-3">
                <Badge>Ballot review</Badge>
                <h2 className="text-2xl font-semibold">Confirm your vote</h2>
                <p className="text-sm text-muted-foreground">
                  Review the candidate details carefully. After submitting, this vote cannot be changed.
                </p>
              </div>
              <div className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4 text-sm">
                <div>{`Election: ${data.election?.title || data.election?.id || "N/A"}`}</div>
                <div>{`Candidate: ${reviewCandidate.name}`}</div>
                <div>{`Party: ${reviewCandidate.party}`}</div>
                <div>{`Constituency: ${reviewCandidate.constituencyId || voterProfile?.constituencyId || "General"}`}</div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => setReviewCandidate(null)}>
                  Cancel
                </Button>
                <Button disabled={votePending} onClick={() => void handleVote(reviewCandidate)}>
                  Submit final vote
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <LiveResultsSection candidates={data.candidates} liveFeed={data.liveFeed} updatedAt={data.updatedAt} />

        <section id="proof" className="section-divider">
          <VoteProofCard vote={voteProof} />
          <ReceiptVerifier initialToken={receiptToken} />
        </section>

        <AdminPreview adminTasks={data.adminTasks} />

        <section id="help" className="container py-10 pb-20">
          <div className="grid gap-6 xl:grid-cols-3">
            {[
              {
                icon: UserRoundCheck,
                title: "Identity handling",
                detail: "Profile data, live capture, and supporting records are used only for private voter verification and audit readiness."
              },
              {
                icon: Clock3,
                title: "Proof retention",
                detail: "Receipt tokens and generated proof stay on your device for convenience and can be revalidated without exposing the vote ledger."
              },
              {
                icon: FileBadge2,
                title: "Support and privacy",
                detail: "If verification is rejected or documents need correction, return to the profile desk and resubmit the updated package."
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title}>
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4">{item.title}</CardTitle>
                    <CardDescription>{item.detail}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <HelpCircle className="size-5 text-primary" />
                <CardTitle>Help and privacy</CardTitle>
              </div>
              <CardDescription>
                This platform checks voter eligibility, stores receipt tokens, and explains each step in a simple way.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sample voter feedback</CardTitle>
                <CardDescription>
                  These are sample testimonial-style reviews for interface presentation only, not verified public endorsements.
                </CardDescription>
              </CardHeader>
              <CardContent className="review-marquee">
                <div className="review-marquee-track gap-4 pr-4">
                  {[...reviewCards, ...reviewCards].map((item, index) => (
                    <div key={`${item.name}-${index}`} className="w-[320px] shrink-0 rounded-2xl border border-border/70 bg-background/60 p-5 shadow-soft">
                      <div className="flex items-center gap-4">
                        <div className="relative size-16 overflow-hidden rounded-2xl border border-border/70 bg-secondary/70">
                          <Image src={item.image} alt={item.name} fill className="object-cover" />
                        </div>
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.city}</div>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.review}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <MobileActionBar onNavigate={scrollToSection as (section: "profile" | "vote" | "results" | "proof") => void} onMenu={() => scrollToSection("help")} />
      </main>
    </AuthGuard>
  );
}
