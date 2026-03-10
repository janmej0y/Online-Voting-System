"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CommandItem = {
  id: string;
  label: string;
  keywords: string[];
  description: string;
  action: () => void;
};

export function CommandMenu({
  open,
  onOpenChange,
  items
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  items: CommandItem[];
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.label, item.description, ...item.keywords].join(" ").toLowerCase().includes(normalized));
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-border/70 bg-card/95 shadow-soft">
        <div className="border-b border-border/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search navigation, actions, admin views, or help"
              className="pl-11"
            />
          </div>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4">
          <div className="grid gap-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-2xl border border-border/70 bg-background/60 p-4 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  item.action();
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{item.label}</div>
                  <Badge>Command</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">No matching commands.</div>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end border-t border-border/70 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useDefaultCommandItems({
  isAdmin,
  isAuthenticated,
  onScroll
}: {
  isAdmin: boolean;
  isAuthenticated: boolean;
  onScroll: (id: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigateToSection(id: string) {
    if (pathname === "/") {
      onScroll(id);
      return;
    }

    router.push(`/#${id}`);
  }

  return useMemo<CommandItem[]>(
    () => [
      {
        id: "home-profile",
        label: "Open profile desk",
        keywords: ["profile verification personal address identity"],
        description: "Jump to the profile and verification workspace.",
        action: () => router.push("/profile")
      },
      {
        id: "home-vote",
        label: "Go to ballot",
        keywords: ["vote candidates ballot election"],
        description: "Open the active ballot section.",
        action: () => navigateToSection("candidates")
      },
      {
        id: "home-results",
        label: "Open live results",
        keywords: ["results turnout count charts"],
        description: "Jump to the live results and turnout section.",
        action: () => navigateToSection("results")
      },
      {
        id: "home-proof",
        label: "Open proof and receipt",
        keywords: ["proof receipt token verify pdf print"],
        description: "Jump to proof generation and receipt validation.",
        action: () => navigateToSection("proof")
      },
      {
        id: "home-help",
        label: "Open help and privacy",
        keywords: ["privacy help identity storage documents"],
        description: "Review how this private platform handles records.",
        action: () => navigateToSection("help")
      },
      ...(isAdmin
        ? [
            {
              id: "admin-panel",
              label: "Open admin panel",
              keywords: ["admin analytics voters elections charts"],
              description: "Manage elections, voters, charts, and review queues.",
              action: () => router.push("/admin")
            }
          ]
        : []),
      ...(!isAuthenticated
        ? [
            {
              id: "login",
              label: "Open login",
              keywords: ["login sign in access"],
              description: "Authenticate to access the private voting workspace.",
              action: () => router.push("/login")
            }
          ]
        : [])
    ],
    [isAdmin, isAuthenticated, onScroll, pathname, router]
  );
}
