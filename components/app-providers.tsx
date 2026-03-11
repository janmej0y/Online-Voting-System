"use client";

import { AuthProvider } from "@/components/auth-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { ToastProvider } from "@/components/toast-provider";
import { ThemeProvider } from "next-themes";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
