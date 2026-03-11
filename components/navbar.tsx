"use client";

import { ArrowLeft, Bell, Command, LogOut, Menu, Search, Shield, UserCircle2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { CommandMenu, useDefaultCommandItems } from "@/components/command-menu";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Navbar({ onCommandScroll }: { onCommandScroll?: (id: string) => void }) {
  const { logout, user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const hasGoogleProvider = user?.providerData.some((provider) => provider.providerId === "google.com");
  const isVerified = Boolean(user && (user.emailVerified || hasGoogleProvider));
  const isAdmin = (user?.email || "").toLowerCase() === "borj18237@gmail.com";
  const commandItems = useDefaultCommandItems({
    isAdmin,
    isAuthenticated: Boolean(user),
    onScroll: (id) => onCommandScroll?.(id)
  });

  const menuItems = [
    ...(user ? [{ href: "/profile", label: "Profile", icon: UserCircle2 }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin panel", icon: Shield }] : []),
    ...(!user ? [{ href: "/login", label: "Login", icon: UserCircle2 }] : [])
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} items={commandItems} />
      <div className="container flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              aria-label="Go back"
              className="hidden lg:inline-flex"
              onClick={() => router.back()}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <span className="text-lg font-semibold">E</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight">EzeeVote</div>
              <div className="truncate text-sm text-muted-foreground">Secure online voting system</div>
            </div>
            <Badge className="hidden md:inline-flex">Operational</Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 xl:flex">
              {user ? (
                <div className="text-right">
                  <div className="max-w-[180px] truncate text-sm font-medium">{user.displayName || user.email}</div>
                  <div className="text-xs text-muted-foreground">{isVerified ? "Verified access" : "Verification pending"}</div>
                </div>
              ) : null}
              {user ? (
                <Badge className={isVerified ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-600"}>
                  {isVerified ? "Verified" : "Pending"}
                </Badge>
              ) : null}
            </div>
            <ThemeToggle />
            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Toggle menu" onClick={() => setMenuOpen((current) => !current)}>
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-[560px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Command className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Quick command"
              placeholder="Search profile, vote, results, proof, admin"
              className="pl-11 pr-11"
              onFocus={() => setCommandOpen(true)}
              onClick={() => setCommandOpen(true)}
              readOnly
            />
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
                {t("profile")}
              </Link>
            ) : null}
            {isAdmin ? (
              <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
                Admin panel
              </Link>
            ) : null}
            {!user ? (
              <Link href="/login" className={buttonVariants({ variant: "outline" })}>
                Login
              </Link>
            ) : null}
            {user ? (
              <Button variant="outline" onClick={() => void logout()}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </Button>
            ) : null}
          </div>
        </div>

        {menuOpen ? (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-soft">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
              <div className="space-y-3">
                {user ? (
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="font-medium">{user.displayName || user.email}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{isVerified ? "Verified access" : "Verification pending"}</div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={buttonVariants({ variant: "outline" })}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon className="mr-2 size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  {user ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMenuOpen(false);
                        void logout();
                      }}
                    >
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3 md:justify-end">
                {user ? (
                  <Badge className={isVerified ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-600"}>
                    {isVerified ? "Verified" : "Pending"}
                  </Badge>
                ) : null}
                <Badge className="hidden md:inline-flex">{t("menu")}</Badge>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
