"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Candidate } from "@/lib/election-data";

export function CandidateCard({
  candidate,
  delay = 0,
  canVote,
  hasVoted,
  isSelected,
  voteHint,
  onVote
}: {
  candidate: Candidate;
  delay?: number;
  canVote: boolean;
  hasVoted: boolean;
  isSelected: boolean;
  voteHint?: string | null;
  onVote: (candidate: Candidate) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="h-full overflow-hidden">
        <CardContent className="flex h-full flex-col gap-5 p-5">
          <div className="flex items-center gap-4">
            <div className="relative size-16 overflow-hidden rounded-2xl border border-border/70">
              <Image src={candidate.image} alt={candidate.name} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold">{candidate.name}</h3>
              <p className="truncate text-sm text-muted-foreground">{candidate.party}</p>
            </div>
            <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2">
              <Image src={candidate.symbol} alt={`${candidate.party} symbol`} fill className="object-contain p-2" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Vote share</span>
              <span className="font-medium">{candidate.percentage}%</span>
            </div>
            <Progress value={candidate.percentage} />
            <div className="text-sm text-muted-foreground">{candidate.votes.toLocaleString()} votes counted</div>
            {candidate.constituencyId && (
              <div className="text-xs text-muted-foreground">{`Constituency: ${candidate.constituencyId}`}</div>
            )}
            {candidate.manifestoUrl && (
              <Link href={candidate.manifestoUrl} target="_blank" className="text-xs font-medium text-primary">
                View manifesto
              </Link>
            )}
          </div>
          <Button className="mt-auto w-full" disabled={hasVoted} onClick={() => onVote(candidate)}>
            {isSelected ? "Vote recorded" : hasVoted ? "Already voted" : canVote ? "Vote now" : "Why can't I vote?"}
          </Button>
          {!canVote && !hasVoted && voteHint ? <div className="text-xs text-muted-foreground">{voteHint}</div> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
