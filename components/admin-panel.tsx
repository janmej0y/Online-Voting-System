"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Navbar } from "@/components/navbar";
import { SimpleBarChart, SimpleDonutChart } from "@/components/simple-chart";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Candidate, Election, VoterRecord } from "@/lib/election-data";

type ElectionWithAdminFields = Election & {
  createdAt?: string | null;
  updatedAt?: string | null;
  candidates: Candidate[];
};

type AdminSessionResponse = {
  email: string | null;
  isAdmin: boolean;
  role: "voter" | "reviewer" | "admin";
  adminEmail: string;
  mfaRequired?: boolean;
  mfaVerified?: boolean;
};

type AnalyticsPayload = {
  summary: {
    totalVotes: number;
    approvedVoters: number;
    pendingVoters: number;
    turnout: number;
    activeElections: number;
  };
  votesByElection: Record<string, number>;
  candidateTallies: Record<string, number>;
  anomalies: Array<{
    type: string;
    severity: string;
    count: number;
    detail: string;
  }>;
};

type AuditLog = {
  id: string;
  type?: string;
  electionId?: string;
  electionTitle?: string | null;
  email?: string | null;
  candidateName?: string;
  createdAt?: string | null;
};

const initialElectionForm = {
  id: "",
  title: "",
  description: "",
  rules: "",
  startsAt: "",
  endsAt: ""
};

const initialCandidateForm = {
  id: "",
  name: "",
  party: "",
  image: "",
  symbol: "",
  constituencyId: "",
  manifestoUrl: "",
  bio: ""
};

const initialVoterForm = {
  uid: "",
  email: "",
  displayName: "",
  constituencyId: "",
  eligibleElectionIds: ""
};

async function authorizedFetch<T>(token: string, input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });

  const payload = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
}

export function AdminPanel() {
  const { loading, user } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [elections, setElections] = useState<ElectionWithAdminFields[]>([]);
  const [activeElectionId, setActiveElectionId] = useState<string | null>(null);
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [electionForm, setElectionForm] = useState(initialElectionForm);
  const [candidateForm, setCandidateForm] = useState(initialCandidateForm);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [voterForm, setVoterForm] = useState(initialVoterForm);
  const [mfaCode, setMfaCode] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [voterSearch, setVoterSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [constituencyFilter, setConstituencyFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const selectedElection = useMemo(
    () => elections.find((election) => election.id === selectedElectionId) || null,
    [elections, selectedElectionId]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!selectedElection) {
      setElectionForm(initialElectionForm);
      setCandidateForm(initialCandidateForm);
      setEditingCandidateId(null);
      return;
    }

    setElectionForm({
      id: selectedElection.id,
      title: selectedElection.title,
      description: selectedElection.description || "",
      rules: selectedElection.rules || "",
      startsAt: selectedElection.startsAt || "",
      endsAt: selectedElection.endsAt || ""
    });
  }, [selectedElection]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;

    let cancelled = false;

    async function load() {
      try {
        setBusy(true);
        const token = await currentUser.getIdToken();
        const sessionPayload = await authorizedFetch<AdminSessionResponse>(token, "/api/admin/session", { method: "GET" });
        if (cancelled) return;
        setSession(sessionPayload);
        if (!sessionPayload.isAdmin || (sessionPayload.mfaRequired && !sessionPayload.mfaVerified)) return;

        const [electionPayload, voterPayload, analyticsPayload, auditPayload] = await Promise.all([
          authorizedFetch<{ elections: ElectionWithAdminFields[]; activeElectionId: string | null }>(token, "/api/admin/elections", {
            method: "GET"
          }),
          authorizedFetch<{ voters: VoterRecord[] }>(token, "/api/admin/voters", { method: "GET" }),
          authorizedFetch<AnalyticsPayload>(token, "/api/admin/analytics", { method: "GET" }),
          authorizedFetch<{ logs: AuditLog[] }>(token, "/api/admin/audit-logs", { method: "GET" })
        ]);

        if (cancelled) return;
        setElections(electionPayload.elections);
        setActiveElectionId(electionPayload.activeElectionId);
        setSelectedElectionId(electionPayload.activeElectionId || electionPayload.elections[0]?.id || "");
        setVoters(voterPayload.voters);
        setAnalytics(analyticsPayload);
        setAuditLogs(auditPayload.logs);
      } catch (nextError) {
        if (!cancelled) {
          pushToast({
            tone: "error",
            title: "Admin data load failed",
            description: nextError instanceof Error ? nextError.message : "Admin data load failed."
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pushToast, user]);

  async function refreshAdminData() {
    if (!user || !session?.isAdmin || (session.mfaRequired && !session.mfaVerified)) return;
    const token = await user.getIdToken(true);
    const [electionPayload, voterPayload, analyticsPayload, auditPayload] = await Promise.all([
      authorizedFetch<{ elections: ElectionWithAdminFields[]; activeElectionId: string | null }>(token, "/api/admin/elections", {
        method: "GET"
      }),
      authorizedFetch<{ voters: VoterRecord[] }>(token, "/api/admin/voters", { method: "GET" }),
      authorizedFetch<AnalyticsPayload>(token, "/api/admin/analytics", { method: "GET" }),
      authorizedFetch<{ logs: AuditLog[] }>(token, "/api/admin/audit-logs", { method: "GET" })
    ]);
    setElections(electionPayload.elections);
    setActiveElectionId(electionPayload.activeElectionId);
    setSelectedElectionId((current) => current || electionPayload.activeElectionId || electionPayload.elections[0]?.id || "");
    setVoters(voterPayload.voters);
    setAnalytics(analyticsPayload);
    setAuditLogs(auditPayload.logs);
  }

  async function runAdminAction(action: () => Promise<void>, successMessage: string) {
    try {
      setBusy(true);
      await action();
      await refreshAdminData();
      pushToast({ tone: "success", title: successMessage });
    } catch (nextError) {
      pushToast({
        tone: "error",
        title: "Admin action failed",
        description: nextError instanceof Error ? nextError.message : "Action failed."
      });
    } finally {
      setBusy(false);
    }
  }

  async function createElection() {
    if (!user) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, "/api/admin/elections", {
      method: "POST",
      body: JSON.stringify({
        ...electionForm,
        allowVoting: false,
        makeActive: !activeElectionId
      })
    });
  }

  async function updateElection() {
    if (!user || !selectedElection) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, `/api/admin/elections/${selectedElection.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: electionForm.title,
        description: electionForm.description,
        rules: electionForm.rules,
        startsAt: electionForm.startsAt || null,
        endsAt: electionForm.endsAt || null
      })
    });
  }

  async function setElectionState(electionId: string, status: Election["status"], allowVoting?: boolean, makeActive?: boolean) {
    if (!user) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, `/api/admin/elections/${electionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(typeof allowVoting === "boolean" ? { allowVoting } : {}),
        ...(makeActive ? { makeActive: true } : {})
      })
    });
  }

  async function saveCandidate() {
    if (!user || !selectedElection) return;
    const token = await user.getIdToken();
    const nextCandidates = editingCandidateId
      ? selectedElection.candidates.map((candidate) =>
          candidate.id === editingCandidateId
            ? {
                ...candidate,
                ...candidateForm
              }
            : candidate
        )
      : [
          ...selectedElection.candidates,
          {
            ...candidateForm,
            percentage: 0,
            votes: 0,
            order: selectedElection.candidates.length + 1
          }
        ];
    await authorizedFetch(token, `/api/admin/elections/${selectedElection.id}`, {
      method: "PATCH",
      body: JSON.stringify({ candidates: nextCandidates })
    });
    setCandidateForm(initialCandidateForm);
    setEditingCandidateId(null);
  }

  async function deleteCandidate(candidateId: string) {
    if (!user || !selectedElection) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, `/api/admin/elections/${selectedElection.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        candidates: selectedElection.candidates.filter((candidate) => candidate.id !== candidateId)
      })
    });
    if (editingCandidateId === candidateId) {
      setEditingCandidateId(null);
      setCandidateForm(initialCandidateForm);
    }
  }

  async function upsertVoter() {
    if (!user) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, "/api/admin/voters", {
      method: "POST",
      body: JSON.stringify({
        ...voterForm,
        emailVerified: true,
        eligibleElectionIds: voterForm.eligibleElectionIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      })
    });
    setVoterForm(initialVoterForm);
  }

  async function updateVoterStatus(voterId: string, status: VoterRecord["status"]) {
    if (!user) return;
    const voter = voters.find((item) => item.uid === voterId);
    const token = await user.getIdToken();
    await authorizedFetch(token, `/api/admin/voters/${voterId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        constituencyId: voter?.constituencyId || "",
        eligibleElectionIds: voter?.eligibleElectionIds || [],
        verificationStatus:
          status === "approved" ? "approved" : status === "rejected" ? "rejected" : voter?.verificationStatus || "submitted",
        verificationNotes: reviewNotes[voterId] || voter?.verification?.notes || ""
      })
    });
  }

  async function verifyAdminSecondFactor() {
    if (!user) return;
    const token = await user.getIdToken();
    await authorizedFetch(token, "/api/admin/mfa", {
      method: "POST",
      body: JSON.stringify({ code: mfaCode })
    });
    const sessionPayload = await authorizedFetch<AdminSessionResponse>(token, "/api/admin/session", { method: "GET" });
    setSession(sessionPayload);
    setMfaCode("");
  }

  const filteredVoters = useMemo(() => {
    const normalizedSearch = voterSearch.trim().toLowerCase();
    return voters.filter((voter) => {
      const matchesSearch =
        !normalizedSearch ||
        [voter.displayName, voter.email, voter.uid].join(" ").toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || voter.status === statusFilter;
      const matchesVerification = verificationFilter === "all" || voter.verificationStatus === verificationFilter;
      const matchesConstituency = constituencyFilter === "all" || voter.constituencyId === constituencyFilter;
      return matchesSearch && matchesStatus && matchesVerification && matchesConstituency;
    });
  }, [constituencyFilter, statusFilter, verificationFilter, voterSearch, voters]);

  const totalPages = Math.max(1, Math.ceil(filteredVoters.length / pageSize));
  const paginatedVoters = useMemo(
    () => filteredVoters.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredVoters]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [constituencyFilter, statusFilter, verificationFilter, voterSearch]);

  const constituencyOptions = useMemo(
    () => Array.from(new Set(voters.map((voter) => voter.constituencyId).filter(Boolean))).sort(),
    [voters]
  );

  if (loading || (user && !session && busy)) {
    return (
      <>
        <Navbar />
        <div className="container py-10 text-sm text-muted-foreground">Loading admin panel...</div>
      </>
    );
  }

  if (session && !session.isAdmin) {
    return (
      <>
        <Navbar />
        <section className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Admin access denied</CardTitle>
              <CardDescription>
                Only {session.adminEmail} can open the admin panel. Your current account is {session.email || "not available"}.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </>
    );
  }

  if (session?.isAdmin && session.mfaRequired && !session.mfaVerified) {
    return (
      <>
        <Navbar />
        <section className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Admin second-factor verification</CardTitle>
              <CardDescription>Enter the admin verification code configured on the server to unlock the panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Admin verification code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
              <Button disabled={busy || !mfaCode.trim()} onClick={() => void runAdminAction(verifyAdminSecondFactor, "Admin second factor verified.")}>
                Verify admin access
              </Button>
            </CardContent>
          </Card>
        </section>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container space-y-6 py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin control center</h1>
            <p className="text-sm text-muted-foreground">
              Restricted to {session?.adminEmail || "the configured admin"} with election management, candidate setup, analytics, and voter approvals.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/10 text-emerald-500">Admin verified</Badge>
            {activeElectionId ? <Badge>{`Active election: ${activeElectionId}`}</Badge> : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
          <SimpleBarChart
            title="Turnout by election"
            rows={Object.entries(analytics?.votesByElection || {}).map(([label, value]) => ({ label, value }))}
          />
          <SimpleBarChart
            title="Candidate distribution"
            rows={Object.entries(analytics?.candidateTallies || {}).map(([label, value]) => ({ label, value }))}
            colorClassName="bg-emerald-500"
          />
          <SimpleDonutChart value={analytics?.summary.approvedVoters || 0} total={voters.length || 1} label="Approved voter coverage" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create election</CardTitle>
              <CardDescription>Create election records with title, schedule, description, and operating rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Election id">
                <Input placeholder="Election id" value={electionForm.id} onChange={(event) => setElectionForm((current) => ({ ...current, id: event.target.value }))} />
              </Field>
              <Field label="Election title">
                <Input placeholder="Election title" value={electionForm.title} onChange={(event) => setElectionForm((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field label="Description">
                <Textarea placeholder="Description" value={electionForm.description} onChange={(event) => setElectionForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Rules">
                <Textarea placeholder="Rules and participation notes" value={electionForm.rules} onChange={(event) => setElectionForm((current) => ({ ...current, rules: event.target.value }))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Starts at">
                  <Input type="datetime-local" value={electionForm.startsAt} onChange={(event) => setElectionForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </Field>
                <Field label="Ends at">
                  <Input type="datetime-local" value={electionForm.endsAt} onChange={(event) => setElectionForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </Field>
              </div>
              <Button disabled={busy} onClick={() => void runAdminAction(createElection, "Election saved.")}>
                Save election
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Election operations</CardTitle>
              <CardDescription>Edit metadata, activate a board, and change voting state one election at a time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm"
                value={selectedElectionId}
                onChange={(event) => setSelectedElectionId(event.target.value)}
              >
                <option value="">Select election</option>
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title}
                  </option>
                ))}
              </select>

              {selectedElection ? (
                <div className="space-y-4 rounded-2xl border border-border/70 p-4">
                  <Field label="Title">
                    <Input value={electionForm.title} onChange={(event) => setElectionForm((current) => ({ ...current, title: event.target.value }))} />
                  </Field>
                  <Field label="Description">
                    <Textarea value={electionForm.description} onChange={(event) => setElectionForm((current) => ({ ...current, description: event.target.value }))} />
                  </Field>
                  <Field label="Rules">
                    <Textarea value={electionForm.rules} onChange={(event) => setElectionForm((current) => ({ ...current, rules: event.target.value }))} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Starts at">
                      <Input type="datetime-local" value={electionForm.startsAt} onChange={(event) => setElectionForm((current) => ({ ...current, startsAt: event.target.value }))} />
                    </Field>
                    <Field label="Ends at">
                      <Input type="datetime-local" value={electionForm.endsAt} onChange={(event) => setElectionForm((current) => ({ ...current, endsAt: event.target.value }))} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(updateElection, "Election updated.")}>
                      Save edits
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => setElectionState(selectedElection.id, "scheduled", false, true), "Election activated for the dashboard.")}>
                      Set active
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => setElectionState(selectedElection.id, "active", true), "Voting opened.")}>
                      Open voting
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => setElectionState(selectedElection.id, "paused", false), "Election paused.")}>
                      Pause
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => setElectionState(selectedElection.id, "closed", false), "Election closed.")}>
                      Close
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => setElectionState(selectedElection.id, "certified", false), "Election certified.")}>
                      Certify
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {`Status: ${selectedElection.status} | Candidates: ${selectedElection.candidates.length} | Voting: ${selectedElection.allowVoting ? "enabled" : "disabled"}`}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Voter registry</CardTitle>
              <CardDescription>Create voter records and review filtered voter queues at scale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <Input placeholder="Firebase uid" value={voterForm.uid} onChange={(event) => setVoterForm((current) => ({ ...current, uid: event.target.value }))} />
                <Input placeholder="Email" value={voterForm.email} onChange={(event) => setVoterForm((current) => ({ ...current, email: event.target.value }))} />
                <Input placeholder="Display name" value={voterForm.displayName} onChange={(event) => setVoterForm((current) => ({ ...current, displayName: event.target.value }))} />
                <Input placeholder="Constituency id" value={voterForm.constituencyId} onChange={(event) => setVoterForm((current) => ({ ...current, constituencyId: event.target.value }))} />
                <Input
                  placeholder="Eligible election ids, comma separated"
                  value={voterForm.eligibleElectionIds}
                  onChange={(event) => setVoterForm((current) => ({ ...current, eligibleElectionIds: event.target.value }))}
                />
                <Button disabled={busy} onClick={() => void runAdminAction(upsertVoter, "Voter saved to the registry.")}>
                  Save voter
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Search by email, name, or UID" value={voterSearch} onChange={(event) => setVoterSearch(event.target.value)} />
                <select className="h-11 rounded-xl border border-input bg-background px-4 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select className="h-11 rounded-xl border border-input bg-background px-4 text-sm" value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)}>
                  <option value="all">All verification states</option>
                  <option value="approved">Approved</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="rejected">Rejected</option>
                  <option value="unsubmitted">Unsubmitted</option>
                </select>
                <select className="h-11 rounded-xl border border-input bg-background px-4 text-sm" value={constituencyFilter} onChange={(event) => setConstituencyFilter(event.target.value)}>
                  <option value="all">All constituencies</option>
                  {constituencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {paginatedVoters.map((voter) => (
                  <div key={voter.uid} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-medium">{voter.displayName || voter.email}</div>
                        <div className="text-sm text-muted-foreground">{voter.email}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{`UID: ${voter.uid}`}</span>
                          <span>{`Constituency: ${voter.constituencyId || "unassigned"}`}</span>
                          <span>{`Role: ${voter.role}`}</span>
                        </div>
                        {voter.verification ? (
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <div>{`Verification: ${voter.verificationStatus || "submitted"}`}</div>
                            <div>{`Document: ${voter.verification.documentType} ${voter.verification.documentNumberMasked}`}</div>
                            <div>{`Stored proof: ${voter.verification.documentUrl ? "attached" : "missing"}`}</div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={voter.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : voter.status === "rejected" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-600"}>
                          {voter.status}
                        </Badge>
                        <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => updateVoterStatus(voter.uid, "approved"), "Voter approved.")}>
                          Approve
                        </Button>
                        <Button variant="outline" disabled={busy} onClick={() => void runAdminAction(() => updateVoterStatus(voter.uid, "rejected"), "Voter rejected.")}>
                          Reject
                        </Button>
                      </div>
                    </div>
                    {voter.eligibleElectionIds.length > 0 ? (
                      <div className="mt-3 text-xs text-muted-foreground">Eligible elections: {voter.eligibleElectionIds.join(", ")}</div>
                    ) : null}
                    <Textarea
                      className="mt-3 min-h-20"
                      placeholder="Reviewer notes"
                      value={reviewNotes[voter.uid] ?? voter.verification?.notes ?? ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [voter.uid]: event.target.value }))}
                    />
                  </div>
                ))}
                {filteredVoters.length === 0 ? (
                  <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">No voters match the current filters.</div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">{`Showing ${paginatedVoters.length} of ${filteredVoters.length} voters`}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">{`${currentPage} / ${totalPages}`}</span>
                  <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Analytics and anomalies</CardTitle>
              <CardDescription>Summary metrics and anomaly feed across the current election set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="text-sm text-muted-foreground">Votes cast</div>
                  <div className="mt-1 text-2xl font-semibold">{analytics?.summary.totalVotes ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="text-sm text-muted-foreground">Approved voters</div>
                  <div className="mt-1 text-2xl font-semibold">{analytics?.summary.approvedVoters ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="text-sm text-muted-foreground">Pending reviews</div>
                  <div className="mt-1 text-2xl font-semibold">{analytics?.summary.pendingVoters ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="text-sm text-muted-foreground">Turnout</div>
                  <div className="mt-1 text-2xl font-semibold">{`${analytics?.summary.turnout ?? 0}%`}</div>
                </div>
              </div>

              <div className="space-y-3">
                {(analytics?.anomalies || []).length === 0 ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    No anomalies detected from current summaries.
                  </div>
                ) : (
                  (analytics?.anomalies || []).map((anomaly) => (
                    <div key={`${anomaly.type}-${anomaly.detail}`} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{anomaly.type}</div>
                        <Badge className={anomaly.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-600"}>
                          {anomaly.severity}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{anomaly.detail}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{`Affected count: ${anomaly.count}`}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
              <CardDescription>Latest recorded vote events and election activity written by the server.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-border/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{log.type || "event"}</div>
                    <div className="text-xs text-muted-foreground">{log.createdAt || "unknown time"}</div>
                  </div>
                  <div className="mt-2 text-muted-foreground">{`Election: ${log.electionTitle || log.electionId || "unknown"}`}</div>
                  <div className="text-muted-foreground">{`Candidate: ${log.candidateName || "n/a"}`}</div>
                  <div className="text-muted-foreground">{`Actor: ${log.email || "system"}`}</div>
                </div>
              ))}
              {auditLogs.length === 0 ? <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">No audit events yet.</div> : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
