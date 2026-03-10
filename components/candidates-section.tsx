import { CandidateCard } from "@/components/candidate-card";
import { SectionHeading } from "@/components/section-heading";
import type { Candidate } from "@/lib/election-data";

export function CandidatesSection({
  candidates,
  canVote,
  voteHint,
  votedCandidateId,
  onVote
}: {
  candidates: Candidate[];
  canVote: boolean;
  voteHint?: string | null;
  votedCandidateId: string | null;
  onVote: (candidate: Candidate) => void;
}) {
  return (
    <section id="candidates" className="container space-y-8 py-10">
      <SectionHeading
        eyebrow="Candidates"
        title="Review candidate profiles before you cast a vote"
        description="A structured ballot interface with clear party labels, live vote share visibility, and a reliable call to action on every screen size."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {candidates.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            delay={index * 0.05}
            canVote={canVote}
            voteHint={voteHint}
            hasVoted={Boolean(votedCandidateId)}
            isSelected={votedCandidateId === candidate.id}
            onVote={onVote}
          />
        ))}
      </div>
    </section>
  );
}
