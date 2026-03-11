"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mode = "signin" | "signup";

const passwordHint = "Use at least 8 characters for a production-ready credential.";

export function LoginForm() {
  const {
    configured,
    loading,
    refreshUser,
    resendVerification,
    resetPassword,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    user
  } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasGoogleProvider = user?.providerData.some((provider) => provider.providerId === "google.com") ?? false;

  useEffect(() => {
    if (!loading && user && (hasGoogleProvider || user.emailVerified)) {
      router.replace("/");
    }
  }, [hasGoogleProvider, loading, router, user]);

  const needsVerification = Boolean(user && !user.emailVerified && !hasGoogleProvider);

  function runAction(action: () => Promise<void>, successMessage?: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        if (successMessage) setMessage(successMessage);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
      }
    });
  }

  return (
    <section className="container flex min-h-screen items-center py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="hero-gradient soft-grid space-y-8 rounded-[2rem] border border-white/10 p-8 text-white shadow-soft sm:p-10"
        >
          <div className="space-y-4">
            <Badge className="bg-white/10 text-white">Secure Access</Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Secure access that feels clear, fast, and trustworthy
            </h1>
            <p className="max-w-2xl text-base leading-8 text-white/80">
              Sign in with Google or verified email, confirm your account, and move directly into the guided voting flow.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Fast entry", copy: "Google sign-in for quick access with less friction." },
              { title: "Verified identity", copy: "Email users verify once, then access the full dashboard." },
              { title: "Clear recovery", copy: "Reset password or resend verification without leaving this page." }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-medium">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-white/70">{item.copy}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <CardTitle>{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
              <CardDescription>
                {mode === "signin"
                  ? "Sign in with Google or email/password."
                  : "Create an email account and verify it before entering the dashboard."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!configured && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                  Firebase Auth is not configured. Add your `NEXT_PUBLIC_FIREBASE_*` values to `.env.local` first.
                </div>
              )}

              {needsVerification && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-4 text-emerald-500" />
                    <div className="space-y-3">
                      <div>
                        <div className="font-medium">Verify your email before dashboard access</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Open the verification link sent to {user?.email} and then refresh your status.
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => runAction(resendVerification, "Verification email sent again.")} disabled={pending}>
                          Resend verification
                        </Button>
                        <Button onClick={() => runAction(refreshUser)} disabled={pending}>
                          I verified my email
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="w-full gap-2"
                variant="outline"
                onClick={() => runAction(signInWithGoogle)}
                disabled={pending || !configured}
              >
                <ShieldCheck className="size-4" />
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/70" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="bg-card px-3">Or with email</span>
                </div>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const action = mode === "signin" ? () => signInWithEmail(email, password) : () => signUpWithEmail(email, password);
                  const success =
                    mode === "signup"
                      ? "Account created. Check your inbox and verify your email."
                      : "Signed in successfully.";
                  runAction(action, success);
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">{passwordHint}</p>
                </div>

                {message && (
                  <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 size-4" />
                    <span>{message}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 size-4" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full gap-2" disabled={pending || !configured}>
                  {mode === "signin" ? "Sign in with email" : "Create account"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>

              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="text-left font-medium text-foreground"
                  onClick={() => {
                    setMode((current) => (current === "signin" ? "signup" : "signin"));
                    setMessage(null);
                    setError(null);
                  }}
                >
                  {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
                </button>
                <div className="flex items-center gap-3">
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="font-medium text-primary"
                      onClick={() =>
                        runAction(
                          async () => {
                            if (!email) throw new Error("Enter your email first.");
                            await resetPassword(email);
                          },
                          "Password reset email sent."
                        )
                      }
                    >
                      Forgot password
                    </button>
                  )}
                  <Link href="/" className="font-medium text-primary">
                    Back to dashboard shell
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
