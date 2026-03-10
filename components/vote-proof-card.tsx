"use client";

import Image from "next/image";
import { jsPDF } from "jspdf";
import { Download, FileCheck2, Printer, ScrollText, Signature } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FileDropzone } from "@/components/file-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type VoteProofRecord = {
  electionId?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  token?: string | null;
  votedAt?: string | null;
  voterName?: string | null;
  voterEmail?: string | null;
};

type DownloadHistoryItem = {
  downloadedAt: string;
  type: "pdf" | "print";
};

const historyKey = "ezeevote-proof-download-history";
const signatureKey = "ezeevote-proof-signature";
const defaultOfficerName = "Janmejoy Mahato";
const defaultOfficerTitle = "Presiding Officer";

function buildHistoryKey(vote: VoteProofRecord) {
  return `${vote.electionId || "unknown"}:${vote.token || "token"}`;
}

function maskToken(token: string) {
  return `${token.slice(0, 22)}...${token.slice(-16)}`;
}

function drawSeal(pdf: jsPDF, centerX: number, centerY: number) {
  pdf.setDrawColor(179, 39, 45);
  pdf.setLineWidth(1.2);
  pdf.circle(centerX, centerY, 18, "S");
  pdf.circle(centerX, centerY, 14, "S");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(179, 39, 45);
  pdf.text("EZEEVOTE", centerX, centerY - 2, { align: "center" });
  pdf.text("SEAL", centerX, centerY + 4, { align: "center" });
}

export function VoteProofCard({ vote }: { vote: VoteProofRecord | null }) {
  const [signatureImage, setSignatureImage] = useState("");
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);

  useEffect(() => {
    if (!vote?.token) return;
    const storedSignature = window.localStorage.getItem(signatureKey) || "";
    setSignatureImage(storedSignature);
    const history = JSON.parse(window.localStorage.getItem(historyKey) || "{}") as Record<string, DownloadHistoryItem[]>;
    setDownloadHistory(history[buildHistoryKey(vote)] || []);
  }, [vote]);

  const validationState = useMemo(() => (vote?.token ? "Validated record available" : "Pending"), [vote?.token]);

  if (!vote?.token) return null;
  const proof = vote;
  const receiptToken = proof.token || "";

  function appendHistory(item: DownloadHistoryItem) {
    const history = JSON.parse(window.localStorage.getItem(historyKey) || "{}") as Record<string, DownloadHistoryItem[]>;
    const nextHistory = {
      ...history,
      [buildHistoryKey(proof)]: [...(history[buildHistoryKey(proof)] || []), item]
    };
    window.localStorage.setItem(historyKey, JSON.stringify(nextHistory));
    setDownloadHistory(nextHistory[buildHistoryKey(proof)]);
  }

  function downloadProofPdf() {
    const pdf = new jsPDF("portrait", "mm", "a4");
    pdf.setFillColor(235, 244, 255);
    pdf.rect(0, 0, 210, 297, "F");

    pdf.setFillColor(20, 67, 116);
    pdf.rect(0, 0, 210, 34, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("EzeeVote", 20, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Private Vote Receipt and Certificate", 20, 26);

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(12, 24, 186, 255, 6, 6, "F");
    pdf.setDrawColor(54, 104, 158);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(16, 38, 178, 227, 5, 5, "S");

    pdf.setTextColor(20, 24, 39);
    pdf.setFont("times", "bold");
    pdf.setFontSize(24);
    pdf.text("Vote Record Certificate", 24, 56);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    pdf.text("This colour certificate confirms that one final vote was recorded on the EzeeVote private platform.", 24, 66);

    pdf.setFillColor(244, 248, 252);
    pdf.roundedRect(24, 76, 162, 58, 4, 4, "F");
    const rows = [
      ["Holder", proof.voterName || proof.voterEmail || "Private participant"],
      ["Election", proof.electionId || "N/A"],
      ["Candidate", proof.candidateName || proof.candidateId || "N/A"],
      ["Recorded at", proof.votedAt || "N/A"],
      ["Receipt token", maskToken(receiptToken)]
    ];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    rows.forEach(([label, value], index) => {
      const y = 88 + index * 10;
      pdf.text(`${label}:`, 30, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(value), 66, y);
      pdf.setFont("helvetica", "bold");
    });

    pdf.setFillColor(255, 247, 237);
    pdf.roundedRect(24, 146, 162, 34, 4, 4, "F");
    pdf.setTextColor(124, 45, 18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Institutional validation note", 30, 158);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.text("The receipt token can be revalidated inside the portal without exposing how the encrypted vote ledger is checked.", 30, 168, {
      maxWidth: 145
    });

    pdf.setTextColor(20, 24, 39);
    pdf.setFillColor(245, 243, 255);
    pdf.roundedRect(24, 190, 100, 46, 4, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Authorization", 30, 202);
    pdf.setFont("times", "italic");
    pdf.setFontSize(18);
    if (signatureImage.startsWith("data:image")) {
      pdf.addImage(signatureImage, "PNG", 30, 206, 42, 16);
    } else {
      pdf.text(defaultOfficerName, 30, 218);
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(defaultOfficerTitle, 30, 228);

    drawSeal(pdf, 154, 214);

    pdf.setDrawColor(203, 213, 225);
    pdf.line(24, 246, 186, 246);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(9);
    pdf.text("EzeeVote secure receipt | For private retention, audit reference, and print-ready archive use.", 24, 254);
    pdf.text(`Certificate ref: ${receiptToken.slice(-18)}`, 24, 261);
    pdf.save(`ezeevote-vote-proof-${proof.electionId || "receipt"}.pdf`);
    appendHistory({ downloadedAt: new Date().toISOString(), type: "pdf" });
  }

  function printProof() {
    appendHistory({ downloadedAt: new Date().toISOString(), type: "print" });
    window.print();
  }

  return (
    <section className="container py-10">
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="print-surface overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-gradient-to-r from-sky-950 via-sky-900 to-blue-900 text-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-sky-100/70">EzeeVote</div>
                <CardTitle className="mt-2 text-3xl text-white">Private vote proof certificate</CardTitle>
                <CardDescription className="text-sky-100/80">
                  Colour certificate, officer block, validation state, and print-grade receipt presentation.
                </CardDescription>
              </div>
              <Badge className="border-white/15 bg-white/10 text-white">{validationState}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-[1.8rem] border border-border/70 bg-gradient-to-br from-slate-50 via-sky-50 to-blue-100 p-6 text-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Certificate no.</div>
                  <div className="mt-2 text-lg font-semibold">{receiptToken.slice(-18)}</div>
                  <div className="mt-1 text-sm text-slate-600">Private vote record certificate</div>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600">
                  <FileCheck2 className="size-8" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Voter</div>
                  <div className="mt-2 font-semibold">{proof.voterName || proof.voterEmail || "Private participant"}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Election</div>
                  <div className="mt-2 font-semibold">{proof.electionId || "N/A"}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected candidate</div>
                  <div className="mt-2 font-semibold">{proof.candidateName || proof.candidateId || "N/A"}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Recorded at</div>
                  <div className="mt-2 font-semibold">{proof.votedAt || "Unknown time"}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-950 p-4 text-xs text-sky-100">
                <div className="uppercase tracking-[0.3em] text-sky-200/80">Receipt token</div>
                <div className="mt-2 break-all font-mono">{receiptToken}</div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                  Use this token to validate the receipt inside the portal. The certificate proves that a ballot was recorded without exposing the vote-verification internals.
                </div>
                <div className="rounded-[50%] border-4 border-rose-700 px-5 py-6 text-center text-xs font-semibold uppercase tracking-[0.28em] text-rose-700">
                  EzeeVote
                  <br />
                  Seal
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-3">
                  <ScrollText className="size-5 text-primary" />
                  <div>
                    <div className="font-medium">Presiding officer block</div>
                    <div className="text-sm text-muted-foreground">{defaultOfficerName} | {defaultOfficerTitle}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadProofPdf}>
                  <Download className="mr-2 size-4" />
                  Download PDF proof
                </Button>
                <Button variant="outline" onClick={printProof}>
                  <Printer className="mr-2 size-4" />
                  Print proof
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Signature className="size-5 text-primary" />
                <CardTitle>Officer signature override</CardTitle>
              </div>
              <CardDescription>
                The certificate uses a built-in Janmejoy Mahato presiding officer block. Upload a custom signature image only if you want to override it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                label="Signature image"
                description="PNG or JPEG works best if you want to replace the default officer signature treatment."
                value={signatureImage}
                accept="image/*"
                onChange={(value) => {
                  setSignatureImage(value);
                  window.localStorage.setItem(signatureKey, value);
                }}
              />
              {signatureImage.startsWith("data:image") ? (
                <div className="relative h-28 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
                  <Image src={signatureImage} alt="Signature preview" fill className="object-contain p-4" unoptimized />
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  Default signature style will be used with officer name, title, and a visible EzeeVote seal.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proof activity</CardTitle>
              <CardDescription>Track certificate export and print history from this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {downloadHistory.length === 0 ? (
                <div className="rounded-2xl border border-border/70 p-4 text-muted-foreground">No proof downloads or prints recorded on this device yet.</div>
              ) : (
                downloadHistory
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <div key={`${entry.downloadedAt}-${index}`} className="rounded-2xl border border-border/70 p-4">
                      <div className="font-medium">{entry.type === "pdf" ? "PDF downloaded" : "Printed"}</div>
                      <div className="mt-1 text-muted-foreground">{entry.downloadedAt}</div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
