"use client";

import { Activity, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import type { Stat } from "@/lib/election-data";

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <section className="container py-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
          >
            <Card className="h-full">
              <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <div className="mt-2 h-1.5 w-16 rounded-full bg-secondary">
                      <div className={`h-1.5 rounded-full ${stat.tone === "primary" ? "w-10 bg-primary" : "w-12 bg-emerald-500"}`} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary p-3">
                    {stat.tone === "primary" ? (
                      <Activity className="size-4 text-primary" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-semibold tracking-tight sm:text-4xl">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.change}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
