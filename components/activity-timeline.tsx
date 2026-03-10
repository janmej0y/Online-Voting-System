import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ActivityTimeline({
  items,
  title = "Activity timeline",
  description = "Private account and vote proof events."
}: {
  items: Array<{ title: string; detail: string; date?: string | null; status?: string }>;
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="flex gap-4">
            <div className="mt-1 flex flex-col items-center">
              <div className="size-3 rounded-full bg-primary" />
              {index < items.length - 1 ? <div className="mt-2 h-full w-px bg-border" /> : null}
            </div>
            <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium">{item.title}</div>
                {item.status ? <Badge>{item.status}</Badge> : null}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
              {item.date ? <div className="mt-2 text-xs text-muted-foreground">{item.date}</div> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
