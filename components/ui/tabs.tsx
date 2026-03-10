"use client";

import { cn } from "@/lib/utils";

export function Tabs({
  value,
  onValueChange,
  tabs,
  className
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: Array<{ value: string; label: string; description?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 sm:grid-cols-2 xl:grid-cols-5",
        className
      )}
      role="tablist"
      aria-label="Section tabs"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "rounded-xl px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-primary text-primary-foreground shadow-soft" : "bg-background/60 hover:bg-secondary"
            )}
          >
            <div className="text-sm font-semibold">{tab.label}</div>
            {tab.description ? (
              <div className={cn("mt-1 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {tab.description}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
