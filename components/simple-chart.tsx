import { cn } from "@/lib/utils";

export function SimpleBarChart({
  title,
  rows,
  colorClassName = "bg-primary"
}: {
  title: string;
  rows: Array<{ label: string; value: number; suffix?: string }>;
  colorClassName?: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="text-muted-foreground">{`${row.value}${row.suffix || ""}`}</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-500", colorClassName)}
                style={{ width: `${(row.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimpleDonutChart({
  value,
  total,
  label
}: {
  value: number;
  total: number;
  label: string;
}) {
  const safeTotal = Math.max(total, 1);
  const percentage = Math.max(0, Math.min(100, Math.round((value / safeTotal) * 100)));

  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid size-24 place-items-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${percentage}%, hsl(var(--secondary)) ${percentage}% 100%)`
          }}
        >
          <div className="grid size-16 place-items-center rounded-full bg-background text-sm font-semibold">{percentage}%</div>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>{`${value} of ${safeTotal}`}</div>
          <div>Participation coverage</div>
        </div>
      </div>
    </div>
  );
}
