import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  helper,
  error,
  required,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2", className)} htmlFor={htmlFor}>
      <span className="flex items-center gap-2 text-sm font-medium">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
      {!error && helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </label>
  );
}
