"use client";

import Image from "next/image";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight, Crop, HelpCircle, Loader2, Printer, Save, ShieldCheck } from "lucide-react";
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
import { formatStatusLabel, getStatusTone } from "@/lib/utils";

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
type StepValue = (typeof profileTabs)[number]["value"];

const profileTabs = [
  { value: "personal", label: "Step 1", description: "Your basic details" },
  { value: "address", label: "Step 2", description: "Where you live" },
  { value: "identity", label: "Step 3", description: "ID and proof files" },
  { value: "live-capture", label: "Step 4", description: "Photo for verification" },
  { value: "review", label: "Step 5", description: "Check and submit" }
] as const;

const fieldLabels: Partial<Record<keyof FormState, string>> = {
  displayName: "Full name",
  phone: "Phone number",
  dateOfBirth: "Date of birth",
  constituencyId: "Constituency",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  postalCode: "Postal code",
  documentNumber: "Document number",
  aadhaarNumber: "Aadhaar number",
  voterIdNumber: "Voter ID number",
  documentUrl: "Identity proof file",
  addressProofUrl: "Address proof file",
  selfieImageDataUrl: "Selfie photo"
};

const sectionFieldMap: Record<Exclude<StepValue, "review">, Array<keyof FormState>> = {
  personal: ["displayName", "phone", "dateOfBirth", "constituencyId"],
  address: ["addressLine1", "city", "state", "postalCode"],
  identity: ["documentNumber", "aadhaarNumber", "voterIdNumber", "documentUrl", "addressProofUrl"],
  "live-capture": ["selfieImageDataUrl"]
};

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

function getFieldError(key: keyof FormState, form: FormState) {
  if (key === "displayName" && !form.displayName.trim()) return "Full name is required.";
  if (key === "phone" && formatPhone(form.phone).length !== 10) return "Enter a 10-digit Indian mobile number.";
  if (key === "dateOfBirth") {
    if (!form.dateOfBirth) return "Date of birth is required.";
    const dob = new Date(form.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (age < 18) return "Voter must be at least 18 years old.";
  }
  if (key === "constituencyId" && !form.constituencyId.trim()) return "Constituency is required.";
  if (key === "addressLine1" && !form.addressLine1.trim()) return "Primary address line is required.";
  if (key === "city" && !form.city.trim()) return "City is required.";
  if (key === "state" && !form.state.trim()) return "State is required.";
  if (key === "postalCode" && formatPostalCode(form.postalCode).length !== 6) return "Enter a 6-digit postal code.";
  if (key === "aadhaarNumber" && digitsOnly(form.aadhaarNumber).length !== 12) return "Enter a 12-digit Aadhaar number.";
  if (key === "voterIdNumber" && formatVoterId(form.voterIdNumber).length < 8) return "Enter a valid voter ID.";
  if (key === "documentNumber" && !form.documentNumber.trim()) return "Primary document number is required.";
  if (key === "documentUrl" && !form.documentUrl) return "Identity proof upload is required.";
  if (key === "addressProofUrl" && !form.addressProofUrl) return "Address proof upload is required.";
  if (key === "selfieImageDataUrl" && !form.selfieImageDataUrl) return "A live selfie or fallback upload is required.";
  return undefined;
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
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [profile, setProfile] = useState<VoterRecord | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof profileTabs)[number]["value"]>("personal");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dialog, setDialog] = useState<{
    title: string;
    description: string;
    items?: string[];
    tone: "error" | "success";
  } | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [openHelp, setOpenHelp] = useState<Record<string, boolean>>({});

  const completion = useMemo(() => getCompletion(form), [form]);
  const allValidationErrors = useMemo(() => validateForm(form), [form]);
  const completedItems = useMemo(() => {
    return [
      Boolean(form.displayName && form.phone && form.dateOfBirth && form.constituencyId),
      Boolean(form.addressLine1 && form.city && form.state && form.postalCode),
      Boolean(form.documentNumber && form.aadhaarNumber && form.voterIdNumber && form.documentUrl && form.addressProofUrl),
      Boolean(form.selfieImageDataUrl),
      Boolean(completion === 100)
    ].filter(Boolean).length;
  }, [completion, form]);
  const checklistItems = useMemo(
    () => [
      { label: "Basic details complete", done: sectionFieldMap.personal.every((field) => !getFieldError(field, form)) },
      { label: "Address complete", done: sectionFieldMap.address.every((field) => !getFieldError(field, form)) },
      { label: "Proof documents uploaded", done: sectionFieldMap.identity.every((field) => !getFieldError(field, form)) },
      { label: "Photo added", done: sectionFieldMap["live-capture"].every((field) => !getFieldError(field, form)) },
      { label: "Ready to submit", done: Object.keys(allValidationErrors).length === 0 }
    ],
    [allValidationErrors, form]
  );
  const nextAction = useMemo(() => {
    const firstErrorEntry = Object.entries(allValidationErrors)[0];
    if (!firstErrorEntry) return "All details look complete. Review and submit your registration.";
    return `Next: fix ${fieldLabels[firstErrorEntry[0] as keyof FormState] || firstErrorEntry[0]}.`;
  }, [allValidationErrors]);
  const rejectionReason =
    profile?.verificationStatus === "rejected"
      ? profile.verification?.notes || "Your submitted details or documents need correction before approval."
      : null;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setErrors((current) => ({ ...current, [key]: getFieldError(key, nextForm) }));
  }

  function toggleHelp(section: string) {
    setOpenHelp((current) => ({ ...current, [section]: !current[section] }));
  }

  function openErrorDialog(title: string, description: string, items?: string[]) {
    setDialog({ title, description, items, tone: "error" });
  }

  function openSuccessDialog(title: string, description: string) {
    setDialog({ title, description, tone: "success" });
  }

  function goToStep(direction: "next" | "previous") {
    const currentIndex = profileTabs.findIndex((item) => item.value === activeTab);
    const nextIndex =
      direction === "next"
        ? Math.min(profileTabs.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
    setActiveTab(profileTabs[nextIndex].value);
  }

  function renderStepControls() {
    const firstStep = activeTab === profileTabs[0].value;
    const lastStep = activeTab === "review";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
        <Button variant="outline" onClick={() => goToStep("previous")} disabled={firstStep || busy}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy} onClick={() => void saveProfile()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save and continue later
          </Button>
          {!lastStep ? (
            <Button onClick={() => goToStep("next")} disabled={busy}>
              Next
              <ChevronRight className="ml-2 size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    const currentUser = user;

    let cancelled = false;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
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
        openErrorDialog("Could not load your profile", nextError instanceof Error ? nextError.message : "Failed to load profile.");
        pushToast({
          tone: "error",
          title: "Profile load failed",
          description: nextError instanceof Error ? nextError.message : "Failed to load profile."
        });
      } finally {
        if (!cancelled) setLoadingProfile(false);
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
      openErrorDialog(
        "Camera not available",
        "We could not open your camera. Allow camera permission in the browser or upload your photo below."
      );
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
    if (Object.keys(profileErrors).length > 0) {
      openErrorDialog(
        "Please fix these details first",
        "Your basic profile is not complete yet.",
        Object.entries(profileErrors).map(([key, message]) => `${fieldLabels[key as keyof FormState] || key}: ${message}`)
      );
      return;
    }

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
      openSuccessDialog("Profile saved", "Your personal and address details were saved successfully.");
    } catch (nextError) {
      openErrorDialog("Profile could not be saved", nextError instanceof Error ? nextError.message : "Profile save failed.");
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
      openErrorDialog(
        "Some information is missing or incorrect",
        "Please correct the items below, then submit again.",
        Object.entries(validationErrors).map(([key, message]) => `${fieldLabels[key as keyof FormState] || key}: ${message}`)
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
      setConfirmSubmitOpen(false);
      pushToast({
        tone: "success",
        title: "Verification submitted",
        description: "Your identity package was sent to the private review desk."
      });
      openSuccessDialog("Registration submitted", "Your profile registration was sent for verification. We will review your details and documents.");
      setActiveTab("review");
    } catch (nextError) {
      openErrorDialog(
        "Registration was not submitted",
        nextError instanceof Error ? nextError.message : "Verification submission failed."
      );
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

  if (loadingProfile) {
    return (
      <>
        <Navbar />
        <main className="container space-y-6 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Loading your profile</CardTitle>
              <CardDescription>Please wait while we bring your saved details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-secondary/70" />
              <div className="h-32 animate-pulse rounded-2xl bg-secondary/70" />
              <div className="h-16 animate-pulse rounded-2xl bg-secondary/70" />
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar onCommandScroll={(id) => (id === "help" ? document.getElementById("profile-help")?.scrollIntoView({ behavior: "smooth" }) : undefined)} />
      <main className="container space-y-6 py-8">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Complete your voter profile</CardTitle>
              <CardDescription>
                Follow the 5 simple steps below. Fill your details, add your documents, take a clear photo, and then submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Progress</div>
                    <div className="text-xs text-muted-foreground">You have completed {completedItems} of 5 steps.</div>
                  </div>
                  <div className="text-2xl font-semibold">{completion}%</div>
                </div>
                <Progress className="mt-4" value={completion} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {checklistItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                      item.done ? "status-success" : "border-border/70 bg-card/60 text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className={`size-4 ${item.done ? "" : "opacity-40"}`} />
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle>What to do next</CardTitle>
              <CardDescription>Use this box when you are not sure which step is still pending.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">{nextAction}</div>
              <div className="rounded-2xl border border-border/70 p-4">
                <div className="text-sm font-medium">Profile status</div>
                <div className="mt-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(profile?.status)}`}>
                    {formatStatusLabel(profile?.status || "pending")}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <div className="text-sm font-medium">Verification status</div>
                <div className="mt-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(profile?.verificationStatus)}`}>
                    {formatStatusLabel(profile?.verificationStatus || "unsubmitted")}
                  </span>
                </div>
              </div>
              {rejectionReason ? <div className="status-danger rounded-2xl p-4 text-sm">{rejectionReason}</div> : null}
              <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                If submission fails, a popup will tell you exactly which field has the problem.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 text-sm font-medium">Step guide</div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof profileTabs)[number]["value"])} tabs={profileTabs as unknown as Array<{ value: string; label: string; description?: string }>} />
        </div>

        {activeTab === "personal" ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Step 1: Your basic details</CardTitle>
                  <CardDescription>Enter the same personal details that appear on your official records.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleHelp("personal")}>
                  <HelpCircle className="mr-2 size-4" />
                  Need help?
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {openHelp.personal ? (
                <div className="status-info rounded-2xl p-4 text-sm">
                  Use your official full name. If your ID name is different, approval can be delayed.
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name" required error={errors.displayName} helper="Use the same full name that appears on your supporting records.">
                  <Input value={form.displayName} onChange={(event) => updateForm("displayName", event.target.value)} />
                </Field>
                <Field label="Phone number" required error={errors.phone} helper="10-digit Indian mobile number.">
                  <Input value={form.phone} onChange={(event) => updateForm("phone", formatPhone(event.target.value))} />
                </Field>
                <Field label="Date of birth" required error={errors.dateOfBirth} helper="Must confirm voting age eligibility.">
                  <Input type="date" value={form.dateOfBirth} onChange={(event) => updateForm("dateOfBirth", event.target.value)} />
                </Field>
                <Field label="Constituency" required error={errors.constituencyId} helper="Enter your constituency or area code.">
                  <Input value={form.constituencyId} onChange={(event) => updateForm("constituencyId", event.target.value)} />
                </Field>
              </div>
              <div className="status-success rounded-2xl p-4 text-sm">This step can be saved separately, so users can stop and continue later.</div>
              {renderStepControls()}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "address" ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Step 2: Your address</CardTitle>
                  <CardDescription>Enter the address that matches your proof document.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleHelp("address")}>
                  <HelpCircle className="mr-2 size-4" />
                  Need help?
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {openHelp.address ? (
                <div className="status-info rounded-2xl p-4 text-sm">
                  Use the same address shown on your address proof. This helps the admin approve your request faster.
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Address line 1" required error={errors.addressLine1} helper="Street, house number, or locality.">
                  <Input value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} />
                </Field>
                <Field label="Address line 2" helper="Optional landmark or apartment detail.">
                  <Input value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} />
                </Field>
                <Field label="City" required error={errors.city}>
                  <Input value={form.city} onChange={(event) => updateForm("city", event.target.value)} />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Input value={form.state} onChange={(event) => updateForm("state", event.target.value)} />
                </Field>
                <Field label="Postal code" required error={errors.postalCode} helper="6 digits.">
                  <Input value={form.postalCode} onChange={(event) => updateForm("postalCode", formatPostalCode(event.target.value))} />
                </Field>
                <Field label="Country" helper="Defaults to India.">
                  <Input value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
                </Field>
              </div>
              {renderStepControls()}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "identity" ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Step 3: ID and proof documents</CardTitle>
                    <CardDescription>Add your main ID details and upload clear document images or PDF files.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleHelp("identity")}>
                    <HelpCircle className="mr-2 size-4" />
                    Need help?
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {openHelp.identity ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="status-info rounded-2xl p-4 text-sm">Example ID proof: Aadhaar card, voter ID card, or a clear PDF scan.</div>
                    <div className="status-info rounded-2xl p-4 text-sm">Example address proof: utility bill, ration card, or address slip.</div>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Document type" helper="Example: Aadhaar + Voter ID.">
                    <Input value={form.documentType} onChange={(event) => updateForm("documentType", event.target.value)} />
                  </Field>
                  <Field label="Document number" required error={errors.documentNumber} helper="Enter your main document or reference number.">
                    <Input value={form.documentNumber} onChange={(event) => updateForm("documentNumber", event.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Aadhaar number" required error={errors.aadhaarNumber} helper="12 digits. Spaces are added automatically.">
                    <Input value={form.aadhaarNumber} onChange={(event) => updateForm("aadhaarNumber", formatAadhaar(event.target.value))} />
                  </Field>
                  <Field label="Voter ID number" required error={errors.voterIdNumber} helper="Auto-formatted to uppercase.">
                    <Input value={form.voterIdNumber} onChange={(event) => updateForm("voterIdNumber", formatVoterId(event.target.value))} />
                  </Field>
                </div>

                <FileDropzone
                  label="Identity proof"
                  description="Upload Aadhaar, voter card, or a clear PDF/image scan."
                  value={form.documentUrl}
                  onChange={(value) => {
                    updateForm("documentUrl", value);
                  }}
                />
                {errors.documentUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.documentUrl}</div> : null}

                <FileDropzone
                  label="Address proof"
                  description="Upload a utility bill, address card, or another clear proof of address."
                  value={form.addressProofUrl}
                  onChange={(value) => {
                    updateForm("addressProofUrl", value);
                  }}
                />
                {errors.addressProofUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.addressProofUrl}</div> : null}
                {renderStepControls()}
              </CardContent>
            </Card>
            {renderPreviewPanel()}
          </div>
        ) : null}

        {activeTab === "live-capture" ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Step 4: Your photo</CardTitle>
                  <CardDescription>Take a clear selfie or upload one if your camera is not working.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleHelp("live-capture")}>
                  <HelpCircle className="mr-2 size-4" />
                  Need help?
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {openHelp["live-capture"] ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="status-info rounded-2xl p-4 text-sm">Face the camera directly.</div>
                  <div className="status-info rounded-2xl p-4 text-sm">Use good light and avoid shadows.</div>
                  <div className="status-info rounded-2xl p-4 text-sm">Keep the photo clear and not blurred.</div>
                </div>
              ) : null}
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-80 overflow-hidden rounded-3xl border border-border/70 bg-secondary/40">
                {form.selfieImageDataUrl ? (
                  <Image src={form.selfieImageDataUrl} alt="Selfie preview" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    No photo added yet. Start the camera or upload a clear face photo below.
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
                      Open camera
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
                    Camera permission was denied or unavailable. Allow browser permission or use the upload option below.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    Keep your face in the center, use good light, and avoid blurred photos.
                  </div>
                )}

                <FileDropzone
                  label="Upload photo instead"
                  description="Use this if the camera does not open."
                  value={form.selfieImageDataUrl}
                  accept="image/*"
                  onChange={(value) => {
                    setForm((current) => ({ ...current, selfieImageDataUrl: value, profileImageDataUrl: current.profileImageDataUrl || value }));
                    setErrors((current) => ({ ...current, selfieImageDataUrl: undefined }));
                  }}
                />
                {errors.selfieImageDataUrl ? <div className="text-xs text-rose-600 dark:text-rose-300">{errors.selfieImageDataUrl}</div> : null}
              </div>
              </div>
              {renderStepControls()}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "review" ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Step 5: Check and submit</CardTitle>
                <CardDescription>Review your information one last time, then submit your registration for approval.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4 text-sm">
                    <div className="font-medium">Profile status</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(profile?.status)}`}>
                        {formatStatusLabel(profile?.status || "pending")}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4 text-sm">
                    <div className="font-medium">Verification state</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(profile?.verificationStatus)}`}>
                        {formatStatusLabel(profile?.verificationStatus || "unsubmitted")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="status-info rounded-2xl p-4 text-sm">
                  Before final submit, check that your name, documents, and photo all match.
                </div>

                <Textarea
                  placeholder="Optional note"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                />

                {renderPreviewPanel()}

                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy} onClick={() => setConfirmSubmitOpen(true)}>
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
                    Submit registration
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void saveProfile()}>
                    <Save className="mr-2 size-4" />
                    Save draft
                  </Button>
                  {profile?.verification?.submittedAt ? (
                    <Button variant="outline" onClick={() => window.print()}>
                      <Printer className="mr-2 size-4" />
                      Print acknowledgment
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card id="profile-help">
              <CardHeader>
                <CardTitle>Help</CardTitle>
                <CardDescription>Why these details are needed and how to avoid rejection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 p-4">
                  Identity proof and address proof are used to confirm you are eligible to vote in the correct area.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  Your photo helps the review team match the account with the submitted documents.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  If your form is rejected, fix wrong names, blurry files, or wrong constituency details and submit again.
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  Current review summary: {profile?.verification?.submittedAt ? `submitted at ${profile.verification.submittedAt}` : "not submitted"}.
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      {confirmSubmitOpen ? (
        <div className="fixed inset-0 z-[69] bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto mt-14 max-w-xl rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Confirm final submission</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              After you submit, the admin will review your profile and documents. If needed, you can later correct and resubmit.
            </p>
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="text-sm font-medium">Quick final check</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {checklistItems.map((item) => (
                  <li key={item.label}>{`${item.done ? "Done" : "Missing"}: ${item.label}`}</li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void submitVerification()}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
                Confirm and submit
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog ? (
        <div className="fixed inset-0 z-[70] bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto mt-14 max-w-xl rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                  dialog.tone === "error" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {dialog.tone === "error" ? <AlertTriangle className="size-6" /> : <CheckCircle2 className="size-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-semibold">{dialog.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{dialog.description}</p>
                {dialog.items?.length ? (
                  <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="text-sm font-medium">Please check:</div>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {dialog.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setDialog(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
