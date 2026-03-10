"use client";

import Image from "next/image";
import { Camera, CameraOff, Crop, Save, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FileDropzone } from "@/components/file-dropzone";
import { useAuth } from "@/components/auth-provider";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/components/toast-provider";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { VoterRecord } from "@/lib/election-data";

const initialForm = {
  displayName: "",
  phone: "",
  dateOfBirth: "",
  constituencyId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  documentType: "Aadhaar + Voter ID",
  documentNumber: "",
  aadhaarNumber: "",
  voterIdNumber: "",
  documentUrl: "",
  addressProofUrl: "",
  profileImageDataUrl: "",
  selfieImageDataUrl: "",
  notes: ""
};

type FormState = typeof initialForm;
type FieldErrors = Partial<Record<keyof FormState, string>>;

const profileTabs = [
  { value: "personal", label: "Personal", description: "Name, phone, and date of birth" },
  { value: "address", label: "Address", description: "Residential and constituency data" },
  { value: "identity", label: "Identity", description: "Formatted identity records and uploads" },
  { value: "live-capture", label: "Live Capture", description: "Selfie capture, retake, and fallback" },
  { value: "review", label: "Review", description: "Submission checklist and status panel" }
] as const;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  return digitsOnly(value).slice(0, 10);
}

function formatPostalCode(value: string) {
  return digitsOnly(value).slice(0, 6);
}

function formatAadhaar(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatVoterId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function validateForm(form: FormState) {
  const errors: FieldErrors = {};
  if (!form.displayName.trim()) errors.displayName = "Full name is required.";
  if (formatPhone(form.phone).length !== 10) errors.phone = "Enter a 10-digit Indian mobile number.";
  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else {
    const dob = new Date(form.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (age < 18) errors.dateOfBirth = "Voter must be at least 18 years old.";
  }
  if (!form.constituencyId.trim()) errors.constituencyId = "Constituency is required.";
  if (!form.addressLine1.trim()) errors.addressLine1 = "Primary address line is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.state.trim()) errors.state = "State is required.";
  if (formatPostalCode(form.postalCode).length !== 6) errors.postalCode = "Enter a 6-digit postal code.";
  if (digitsOnly(form.aadhaarNumber).length !== 12) errors.aadhaarNumber = "Enter a 12-digit Aadhaar number.";
  if (formatVoterId(form.voterIdNumber).length < 8) errors.voterIdNumber = "Enter a valid voter ID.";
  if (!form.documentNumber.trim()) errors.documentNumber = "Primary document number is required.";
  if (!form.documentUrl) errors.documentUrl = "Identity proof upload is required.";
  if (!form.addressProofUrl) errors.addressProofUrl = "Address proof upload is required.";
  if (!form.selfieImageDataUrl) errors.selfieImageDataUrl = "A live selfie or fallback upload is required.";
  return errors;
}

function getCompletion(form: FormState) {
  const fields = [
    form.displayName,
    form.phone,
    form.dateOfBirth,
    form.constituencyId,
    form.addressLine1,
    form.city,
    form.state,
    form.postalCode,
    form.aadhaarNumber,
    form.voterIdNumber,
    form.documentUrl,
    form.addressProofUrl,
    form.selfieImageDataUrl
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export function VoterVerificationForm() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [profile, setProfile] = useState<VoterRecord | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof profileTabs)[number]["value"]>("personal");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});

  const completion = useMemo(() => getCompletion(form), [form]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;

    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/voter/profile", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const payload = (await response.json().catch(() => null)) as { voter?: VoterRecord; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error || "Failed to load profile.");
        if (!cancelled && payload?.voter) {
          const voter = payload.voter;
          setProfile(voter);
          setForm((current) => ({
            ...current,
            displayName: voter.displayName || "",
            phone: voter.phone || "",
            dateOfBirth: voter.dateOfBirth || "",
            constituencyId: voter.constituencyId || "",
            addressLine1: voter.addressLine1 || "",
            addressLine2: voter.addressLine2 || "",
            city: voter.city || "",
            state: voter.state || "",
            postalCode: voter.postalCode || "",
            country: voter.country || "India",
            profileImageDataUrl: voter.profileImageDataUrl || "",
            selfieImageDataUrl: voter.verification?.selfieImageDataUrl || "",
            documentUrl: voter.verification?.documentUrl || "",
            addressProofUrl: voter.verification?.addressProofUrl || "",
            notes: voter.verification?.notes || ""
          }));
        }
      } catch (nextError) {
        pushToast({
          tone: "error",
          title: "Profile load failed",
          description: nextError instanceof Error ? nextError.message : "Failed to load profile."
        });
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [pushToast, user]);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCapture() {
    try {
      setCameraDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCapturing(true);
    } catch (nextError) {
      setCameraDenied(true);
      pushToast({
        tone: "error",
        title: "Camera access unavailable",
        description: nextError instanceof Error ? nextError.message : "Camera access failed."
      });
    }
  }

  function stopCapture() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturing(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setForm((current) => ({
      ...current,
      profileImageDataUrl: dataUrl,
      selfieImageDataUrl: dataUrl
    }));
    setErrors((current) => ({ ...current, selfieImageDataUrl: undefined }));
    stopCapture();
  }

  function recropPhoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.width;
    const height = canvas.height;
    const cropWidth = width * 0.7;
    const cropHeight = height * 0.7;
    const startX = (width - cropWidth) / 2;
    const startY = (height - cropHeight) / 2;
    const imageData = context.getImageData(startX, startY, cropWidth, cropHeight);
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    context.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    setForm((current) => ({
      ...current,
      profileImageDataUrl: dataUrl,
      selfieImageDataUrl: dataUrl
    }));
  }

  async function saveProfile() {
    if (!user) return;
    const validationErrors = validateForm({ ...form, documentUrl: form.documentUrl || "pending", addressProofUrl: form.addressProofUrl || "pending", selfieImageDataUrl: form.selfieImageDataUrl || "pending", aadhaarNumber: "123412341234", voterIdNumber: "ABC1234567", documentNumber: "PROFILE_ONLY" });
    const profileErrors = Object.fromEntries(
      Object.entries(validationErrors).filter(([key]) =>
        ["displayName", "phone", "dateOfBirth", "constituencyId", "addressLine1", "city", "state", "postalCode"].includes(key)
      )
    ) as FieldErrors;
    setErrors((current) => ({ ...current, ...profileErrors }));
    if (Object.keys(profileErrors).length > 0) return;

    try {
      setBusy(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/voter/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: form.displayName,
          phone: formatPhone(form.phone),
          dateOfBirth: form.dateOfBirth,
          constituencyId: form.constituencyId,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: formatPostalCode(form.postalCode),
          country: form.country,
          profileImageDataUrl: form.profileImageDataUrl || null
        })
      });
      const payload = (await response.json().catch(() => null)) as { voter?: VoterRecord; error?: string } | null;
      if (!response.ok || !payload?.voter) throw new Error(payload?.error || "Profile save failed.");
      setProfile(payload.voter);
      pushToast({
        tone: "success",
        title: "Profile updated",
        description: "Personal and address details were saved."
      });
    } catch (nextError) {
      pushToast({
        tone: "error",
        title: "Profile save failed",
        description: nextError instanceof Error ? nextError.message : "Profile save failed."
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification() {
    if (!user) return;
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setActiveTab(
        validationErrors.displayName || validationErrors.phone || validationErrors.dateOfBirth
          ? "personal"
          : validationErrors.addressLine1 || validationErrors.city || validationErrors.state || validationErrors.postalCode
            ? "address"
            : validationErrors.selfieImageDataUrl
              ? "live-capture"
              : "identity"
      );
      return;
    }

    try {
      setBusy(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/voter/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          phone: formatPhone(form.phone),
          postalCode: formatPostalCode(form.postalCode),
          aadhaarNumber: digitsOnly(form.aadhaarNumber),
          voterIdNumber: formatVoterId(form.voterIdNumber)
        })
      });
      const payload = (await response.json().catch(() => null)) as { voter?: VoterRecord; error?: string } | null;
      if (!response.ok || !payload?.voter) throw new Error(payload?.error || "Verification submission failed.");
      setProfile(payload.voter);
      pushToast({
        tone: "success",
        title: "Verification submitted",
        description: "Your identity package was sent to the private review desk."
      });
      setActiveTab("review");
    } catch (nextError) {
      pushToast({
        tone: "error",
        title: "Verification submission failed",
        description: nextError instanceof Error ? nextError.message : "Verification submission failed."
      });
    } finally {
      setBusy(false);
    }
  }

  function renderPreviewPanel() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document preview panel</CardTitle>
          <CardDescription>Preview uploaded identity, address, and live capture records before submission.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "Identity proof", value: form.documentUrl },
            { label: "Address proof", value: form.addressProofUrl },
            { label: "Live selfie", value: form.selfieImageDataUrl }
          ].map((item) => (
            <div key={item.label} className="overflow-hidden rounded-2xl border border-border/70 bg-background/60">
              {item.value.startsWith("data:image") ? (
                <div className="relative h-44 w-full">
                  <Image src={item.value} alt={item.label} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center p-4 text-sm text-muted-foreground">
                  {item.value ? `${item.label} attached` : `No ${item.label.toLowerCase()} yet`}
                </div>
              )}
              <div className="border-t border-border/70 px-4 py-3 text-sm font-medium">{item.label}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Navbar onCommandScroll={(id) => (id === "help" ? document.getElementById("profile-help")?.scrollIntoView({ behavior: "smooth" }) : undefined)} />
      <main className="container space-y-6 py-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Private profile desk</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Complete your profile, upload identity and address proof, capture a live selfie, and submit a private verification package with clear validation and review guidance.
          </p>
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Profile completion</div>
                <div className="text-xs text-muted-foreground">The review desk expects a complete, consistent profile before approval.</div>
              </div>
              <div className="text-2xl font-semibold">{completion}%</div>
            </div>
            <Progress className="mt-4" value={completion} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof profileTabs)[number]["value"])} tabs={profileTabs as unknown as Array<{ value: string; label: string; description?: string }>} />

        {activeTab === "personal" ? (
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
              <CardDescription>Enter the core identity fields used to match your account to voter records.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" required error={errors.displayName} helper="Use the same full name that appears on your supporting records.">
                <Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
              </Field>
              <Field label="Phone number" required error={errors.phone} helper="10-digit Indian mobile number.">
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: formatPhone(event.target.value) }))} />
              </Field>
              <Field label="Date of birth" required error={errors.dateOfBirth} helper="Must confirm voting age eligibility.">
                <Input type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
              </Field>
              <Field label="Constituency ID" required error={errors.constituencyId} helper="Used to scope your ballot.">
                <Input value={form.constituencyId} onChange={(event) => setForm((current) => ({ ...current, constituencyId: event.target.value }))} />
              </Field>
              <div className="md:col-span-2">
                <Button disabled={busy} onClick={() => void saveProfile()}>
                  <Save className="mr-2 size-4" />
                  Save personal profile
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "address" ? (
          <Card>
            <CardHeader>
              <CardTitle>Address details</CardTitle>
              <CardDescription>Residential information should align with your address proof and assigned constituency.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Address line 1" required error={errors.addressLine1} helper="Street, house number, or locality.">
                <Input value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} />
              </Field>
              <Field label="Address line 2" helper="Optional landmark or apartment detail.">
                <Input value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} />
              </Field>
              <Field label="City" required error={errors.city}>
                <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
              </Field>
              <Field label="State" required error={errors.state}>
                <Input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
              </Field>
              <Field label="Postal code" required error={errors.postalCode} helper="6 digits.">
                <Input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: formatPostalCode(event.target.value) }))} />
              </Field>
              <Field label="Country" helper="Defaults to India.">
                <Input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} />
              </Field>
              <div className="md:col-span-2">
                <Button disabled={busy} onClick={() => void saveProfile()}>
                  <Save className="mr-2 size-4" />
                  Save address
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "identity" ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Identity records</CardTitle>
                <CardDescription>Validation, formatting, and upload previews are enforced here before review submission.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Verification bundle type" helper="Example: Aadhaar + Voter ID bundle.">
                    <Input value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))} />
                  </Field>
                  <Field label="Primary document number" required error={errors.documentNumber} helper="A bundle reference or primary ID number.">
                    <Input value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value.toUpperCase() }))} />
                  </Field>
                  <Field label="Aadhaar number" required error={errors.aadhaarNumber} helper="12 digits, auto-formatted in groups of 4.">
                    <Input value={form.aadhaarNumber} onChange={(event) => setForm((current) => ({ ...current, aadhaarNumber: formatAadhaar(event.target.value) }))} />
                  </Field>
                  <Field label="Voter ID number" required error={errors.voterIdNumber} helper="Auto-formatted to uppercase.">
                    <Input value={form.voterIdNumber} onChange={(event) => setForm((current) => ({ ...current, voterIdNumber: formatVoterId(event.target.value) }))} />
                  </Field>
                </div>

                <FileDropzone
                  label="Identity proof"
                  description="Drag and drop Aadhaar, voter card, or a PDF scan. Inline preview appears immediately."
                  value={form.documentUrl}
                  onChange={(value) => {
                    setForm((current) => ({ ...current, documentUrl: value }));
                    setErrors((current) => ({ ...current, documentUrl: undefined }));
                  }}
                />
                {errors.documentUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.documentUrl}</div> : null}

                <FileDropzone
                  label="Address proof"
                  description="Drag and drop utility bill, address card, or a PDF scan."
                  value={form.addressProofUrl}
                  onChange={(value) => {
                    setForm((current) => ({ ...current, addressProofUrl: value }));
                    setErrors((current) => ({ ...current, addressProofUrl: undefined }));
                  }}
                />
                {errors.addressProofUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.addressProofUrl}</div> : null}
              </CardContent>
            </Card>
            {renderPreviewPanel()}
          </div>
        ) : null}

        {activeTab === "live-capture" ? (
          <Card>
            <CardHeader>
              <CardTitle>Live capture</CardTitle>
              <CardDescription>Take a webcam selfie, retake it, recrop it, or use a secure fallback upload if camera access is denied.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="relative min-h-80 overflow-hidden rounded-3xl border border-border/70 bg-secondary/40">
                {form.selfieImageDataUrl ? (
                  <Image src={form.selfieImageDataUrl} alt="Selfie preview" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    No live selfie captured yet. Use the camera flow or upload a fallback image if permission is denied.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <video
                  ref={videoRef}
                  className={`w-full rounded-3xl border border-border/70 bg-black ${capturing ? "block" : "hidden"}`}
                  muted
                  playsInline
                  aria-label="Live selfie camera preview"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex flex-wrap gap-3">
                  {!capturing ? (
                    <Button onClick={() => void startCapture()}>
                      <Camera className="mr-2 size-4" />
                      Start live capture
                    </Button>
                  ) : (
                    <>
                      <Button onClick={capturePhoto}>
                        <Camera className="mr-2 size-4" />
                        Capture photo
                      </Button>
                      <Button variant="outline" onClick={stopCapture}>
                        Stop camera
                      </Button>
                    </>
                  )}
                  {form.selfieImageDataUrl ? (
                    <>
                      <Button variant="outline" onClick={() => void startCapture()}>
                        Retake
                      </Button>
                      <Button variant="outline" onClick={recropPhoto}>
                        <Crop className="mr-2 size-4" />
                        Recrop
                      </Button>
                    </>
                  ) : null}
                </div>

                {cameraDenied ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                    Camera permission was denied or unavailable. Check browser permissions, then retry. You can also use the fallback upload below.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    Position your face centrally, use neutral lighting, and keep identity records nearby in case the review desk requests follow-up.
                  </div>
                )}

                <FileDropzone
                  label="Fallback selfie upload"
                  description="Use this only if webcam access is denied or unsupported."
                  value={form.selfieImageDataUrl}
                  accept="image/*"
                  onChange={(value) => {
                    setForm((current) => ({
                      ...current,
                      selfieImageDataUrl: value,
                      profileImageDataUrl: current.profileImageDataUrl || value
                    }));
                    setErrors((current) => ({ ...current, selfieImageDataUrl: undefined }));
                  }}
                />
                {errors.selfieImageDataUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.selfieImageDataUrl}</div> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "review" ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Review and submit</CardTitle>
                <CardDescription>Confirm the package, add reviewer notes, and submit to the private verification desk.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4 text-sm">
                    <div className="font-medium">Profile status</div>
                    <div className="mt-1 text-muted-foreground">{profile?.status || "pending"}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4 text-sm">
                    <div className="font-medium">Verification state</div>
                    <div className="mt-1 text-muted-foreground">{profile?.verificationStatus || "unsubmitted"}</div>
                  </div>
                </div>

                <Textarea
                  placeholder="Notes for the private verification desk"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />

                {renderPreviewPanel()}

                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy} onClick={() => void submitVerification()}>
                    <ShieldCheck className="mr-2 size-4" />
                    Submit verification package
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void saveProfile()}>
                    <Save className="mr-2 size-4" />
                    Save draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card id="profile-help">
              <CardHeader>
                <CardTitle>Help and privacy</CardTitle>
                <CardDescription>Why the platform asks for these records and how to reduce avoidable rejections.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 p-4">
                  Identity proof and address proof are stored to validate voter eligibility and constituency mapping.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  Live capture supports manual comparison between the account holder and the submitted supporting records.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  If your submission is rejected, correct mismatched names, blurred scans, or constituency errors and resubmit.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  Current review summary: {profile?.verification?.submittedAt ? `submitted at ${profile.verification.submittedAt}` : "not submitted"}.
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </>
  );
}
