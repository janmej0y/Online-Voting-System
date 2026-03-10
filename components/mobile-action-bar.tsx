"use client";

import { FileBadge, Home, Menu, PieChart, User } from "lucide-react";

import { useLocale } from "@/components/locale-provider";

const iconMap = {
  profile: User,
  vote: Home,
  results: PieChart,
  proof: FileBadge,
  menu: Menu
} as const;

export function MobileActionBar({
  onNavigate,
  onMenu
}: {
  onNavigate: (section: "profile" | "vote" | "results" | "proof") => void;
  onMenu: () => void;
}) {
  const { t } = useLocale();
  const items = [
    { key: "profile", label: t("profile") },
    { key: "vote", label: t("vote") },
    { key: "results", label: t("results") },
    { key: "proof", label: t("proof") }
  ] as const;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border/70 bg-card/90 px-3 py-2 shadow-soft backdrop-blur-xl">
        {items.map((item) => {
          const Icon = iconMap[item.key];
          return (
            <button
              key={item.key}
              type="button"
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              onClick={() => onNavigate(item.key)}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onMenu}
        >
          <Menu className="size-4" />
          <span>{t("menu")}</span>
        </button>
      </div>
    </div>
  );
}
