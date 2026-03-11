"use client";

import { motion } from "framer-motion";
import { Activity, Radio, TimerReset } from "lucide-react";
import { useMemo } from "react";

import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Candidate, LiveFeedRow } from "@/lib/election-data";

export function LiveResultsSection({
  candidates,
  liveFeed,
  updatedAt
}: {
  candidates: Candidate[];
  liveFeed: LiveFeedRow[];
  updatedAt?: string | null;
}) {
  const totalBallots = useMemo(() => liveFeed.reduce((sum, row) => sum + row.ballots, 0), [liveFeed]);
  const pulse = updatedAt ? new Date(updatedAt).getTime() : totalBallots;

  return (
    <section id="results" className="container space-y-8 py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Live Results"
          title="Live results designed to be easy to scan in seconds"
          description="Vote leaders, turnout movement, and district feed updates are grouped into clean blocks so users can understand the election picture immediately."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-emerald-500/10 text-emerald-500">Live Sync</Badge>
          <Badge>{totalBallots.toLocaleString()} ballots processed</Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Vote distribution</CardTitle>
                <CardDescription>Updated continuously across all active regions.</CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
                <Radio className="size-4 text-emerald-500" />
                Pulse {String(pulse).slice(-6)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leading candidate</div>
                <div className="mt-2 text-lg font-semibold">{candidates[0]?.name || "N/A"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total ballots</div>
                <div className="mt-2 text-lg font-semibold">{totalBallots.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active districts</div>
                <div className="mt-2 text-lg font-semibold">{liveFeed.length}</div>
              </div>
            </div>
            {candidates.map((candidate, index) => (
              <motion.div
                key={`${candidate.id}-${pulse}`}
                initial={{ opacity: 0.6, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="space-y-3 rounded-2xl border border-border/70 bg-background/50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{candidate.name}</div>
                    <div className="text-sm text-muted-foreground">{candidate.party}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{candidate.percentage}%</div>
                    <div className="text-sm text-muted-foreground">{candidate.votes.toLocaleString()} votes</div>
                  </div>
                </div>
                <Progress
                  value={candidate.percentage}
                  indicatorClassName={index % 2 === 0 ? "bg-primary" : "bg-emerald-500"}
                />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional feed</CardTitle>
            <CardDescription>Turnout and ballot intake from active districts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveFeed.map((row, index) => (
              <motion.div
                key={`${row.region}-${pulse}`}
                initial={{ opacity: 0.6, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="rounded-2xl border border-border/70 bg-background/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{row.region}</div>
                    <div className="text-sm text-muted-foreground">{row.ballots.toLocaleString()} ballots</div>
                  </div>
                  <div className="text-sm font-medium">{row.turnout}% turnout</div>
                </div>
                <Progress value={row.turnout} indicatorClassName="bg-gradient-to-r from-primary to-cyan-400" />
              </motion.div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="size-4" />
                  Count health
                </div>
                <div className="mt-2 text-xl font-semibold">Stable</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TimerReset className="size-4" />
                  Refresh interval
                </div>
                <div className="mt-2 text-xl font-semibold">{updatedAt ? "Firestore live" : "Fallback mode"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
