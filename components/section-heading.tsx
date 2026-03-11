import { Badge } from "@/components/ui/badge";

export function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-5">
      <Badge className="bg-primary/10 text-primary">{eyebrow}</Badge>
      <div className="max-w-3xl space-y-3">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{title}</h2>
        <div className="flex items-start gap-4">
          <div className="mt-2 hidden h-16 w-px bg-gradient-to-b from-primary/70 to-transparent sm:block" />
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
        </div>
      </div>
    </div>
  );
}
