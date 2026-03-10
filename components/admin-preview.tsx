"use client";

import { CheckCheck, ClipboardList, Shield, Waves } from "lucide-react";
import { motion } from "framer-motion";

import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminTask } from "@/lib/election-data";

const icons = [ClipboardList, Shield, Waves];

export function AdminPreview({ adminTasks }: { adminTasks: AdminTask[] }) {
  return (
    <section className="container space-y-8 py-10 pb-16">
      <SectionHeading
        eyebrow="Admin Panel Preview"
        title="Operations visibility without the clutter of legacy admin tools"
        description="Core admin workflows are surfaced as simple cards, tight status summaries, and readable actions that scale cleanly across desktop and mobile."
      />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-5 p-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Operations snapshot</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Monitor election readiness, review verifications, and keep the counting stream under continuous oversight.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                "12 election boards are in active monitoring mode",
                "1,824 voter checks queued for review",
                "0 unresolved count anomalies in the last 24 hours"
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/50 p-4">
                  <div className="mt-0.5 rounded-full bg-emerald-500/10 p-2 text-emerald-500">
                    <CheckCheck className="size-4" />
                  </div>
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {adminTasks.map((task, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={task.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
              >
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{task.description}</p>
                    </div>
                    <div className="mt-auto rounded-xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
                      {task.status}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
