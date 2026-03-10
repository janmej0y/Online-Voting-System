"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ReceiptPayload = {
  sub?: string;
  email?: string | null;
  electionId?: string;
  candidateId?: string;
  candidateName?: string;
  votedAt?: string;
  exp?: number;
};

export function ReceiptVerifier({
  initialToken
}: {
  initialToken?: string | null;
}) {
  const [token, setToken] = useState(initialToken || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const validationState = useMemo(() => {
    if (busy) return "checking";
    if (receipt) return "valid";
    if (error) return "invalid";
    return "idle";
  }, [busy, error, receipt]);

  async function verifyReceipt() {
    try {
      setBusy(true);
      setError(null);
      setReceipt(null);

      const response = await fetch("/api/receipt/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token })
      });

      const payload = (await response.json().catch(() => null)) as
        | { valid?: boolean; receipt?: ReceiptPayload; error?: string }
        | null;

      if (!response.ok || !payload?.valid || !payload.receipt) {
        throw new Error(payload?.error || "Receipt verification failed.");
      }

      setReceipt(payload.receipt);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Receipt verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container py-10">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Vote receipt verification</CardTitle>
              <CardDescription>Validate a signed vote receipt and inspect the current validation state without exposing the vote ledger.</CardDescription>
            </div>
            <Badge
              className={
                validationState === "valid"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : validationState === "invalid"
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-secondary text-secondary-foreground"
              }
            >
              {validationState}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <Textarea
              className="min-h-40 text-xs"
              placeholder="Paste receipt token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy || !token.trim()} onClick={() => void verifyReceipt()}>
                Verify receipt
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                Print receipt view
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                {validationState === "valid" ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : validationState === "invalid" ? (
                  <XCircle className="size-4 text-rose-500" />
                ) : (
                  <ShieldCheck className="size-4 text-primary" />
                )}
                Validation state
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {validationState === "valid"
                  ? "The submitted token is currently valid."
                  : validationState === "invalid"
                    ? error
                    : "Submit a receipt token to validate it."}
              </div>
            </div>

            {receipt ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                <div className="font-medium text-emerald-700 dark:text-emerald-300">Receipt valid</div>
                <div className="mt-2 text-muted-foreground">{`Election: ${receipt.electionId || "unknown"}`}</div>
                <div className="text-muted-foreground">{`Candidate: ${receipt.candidateName || receipt.candidateId || "unknown"}`}</div>
                <div className="text-muted-foreground">{`Voted at: ${receipt.votedAt || "unknown"}`}</div>
                <div className="text-muted-foreground">{`Holder: ${receipt.email || receipt.sub || "unknown"}`}</div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
