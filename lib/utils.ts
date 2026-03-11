import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusTone(status?: string | null) {
  if (!status) return "bg-slate-500/10 text-slate-600";
  if (status === "approved" || status === "active" || status === "certified") return "bg-emerald-500/10 text-emerald-600";
  if (status === "rejected" || status === "closed") return "bg-rose-500/10 text-rose-600";
  if (status === "pending" || status === "submitted" || status === "under_review" || status === "scheduled") {
    return "bg-amber-500/10 text-amber-700";
  }
  return "bg-sky-500/10 text-sky-700";
}

export function formatStatusLabel(status?: string | null) {
  if (!status) return "Not started";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
