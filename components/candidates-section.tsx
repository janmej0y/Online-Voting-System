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
        title="Review each candidate clearly before you choose"
        description="The ballot now highlights vote share, constituency, manifesto access, and a single strong action so the decision flow stays simple on both desktop and mobile."
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
