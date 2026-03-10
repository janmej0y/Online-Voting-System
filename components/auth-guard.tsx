"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, pathname, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-5 py-4 shadow-soft">
          <LoaderCircle className="size-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Checking session</span>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
