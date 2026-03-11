"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const heroPoints = [
  "Simple step-by-step voting flow",
  "Clear profile and document checks",
  "Live results in one place"
];

export function HeroSection({
  onStartVoting,
  onViewResults
}: {
  onStartVoting: () => void;
  onViewResults: () => void;
}) {
  return (
    <section className="container py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8 rounded-[2rem] border border-border/80 bg-card/80 p-8 shadow-soft backdrop-blur-xl sm:p-10"
        >
          <div className="space-y-5">
            <Badge className="bg-primary/10 text-primary">Online Voting Portal</Badge>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Vote online with clear steps and simple guidance
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Complete your profile, verify your identity, cast your vote, and check the result without needing technical knowledge.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="gap-2" onClick={onStartVoting}>
              Start Voting
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={onViewResults}>
              View Results
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {heroPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                {point}
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Register", value: "Create profile" },
              { label: "Verify", value: "Upload proof" },
              { label: "Vote", value: "One final ballot" }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-lg font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="grid gap-6"
        >
          <Card className="overflow-hidden bg-mesh">
            <CardContent className="space-y-6 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Easy to follow</p>
                  <p className="mt-2 text-3xl font-semibold">5 steps</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
                  <ShieldCheck className="size-6" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="text-sm text-muted-foreground">Profile, verify, vote</div>
                  <div className="mt-2 text-2xl font-semibold">One clear flow</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="text-sm text-muted-foreground">Live turnout trend</div>
                  <div className="mt-2 flex items-end gap-2">
                    {[42, 64, 58, 81, 76, 92, 88].map((value, index) => (
                      <div key={index} className="h-24 flex-1 rounded-full bg-secondary p-1">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-primary to-cyan-400"
                          style={{ height: `${value}%`, marginTop: `${100 - value}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
