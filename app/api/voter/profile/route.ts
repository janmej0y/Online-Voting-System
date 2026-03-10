import { createHash } from "crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { ADMIN_EMAIL, verifyRequestUser } from "@/lib/admin-auth";
import { serializeVoter } from "@/lib/admin-data";
import { getFirebaseServiceUnavailableMessage, isFirestoreUnavailableError } from "@/lib/firebase-errors";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { sendVerificationPendingAdminEmail } from "@/lib/mailer";

function maskDocumentNumber(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function hashDocumentNumber(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function getCurrentUserRecord(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return { user: null, voterRef: null, existing: null };

  const adminDb = getFirebaseAdminDb();
  if (!adminDb) return { user, voterRef: null, existing: null };

  const voterRef = adminDb.collection("voters").doc(user.uid);
  const existing = await voterRef.get();
  return { user, voterRef, existing };
}

function buildFallbackVoter(user: NonNullable<Awaited<ReturnType<typeof verifyRequestUser>>>) {
  return serializeVoter(user.uid, {
    uid: user.uid,
    email: user.email || "",
    displayName: "",
    role: user.isAdmin ? "admin" : "voter",
    status: "pending",
    constituencyId: "",
    eligibleElectionIds: [],
    emailVerified: user.emailVerified,
    verificationStatus: "unsubmitted",
    verification: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { voterRef, existing } = await getCurrentUserRecord(request);
    if (!voterRef) {
      return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
    }

    return NextResponse.json({
      voter: serializeVoter(existing?.id || user.uid, existing?.data())
    });
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return NextResponse.json({
        voter: buildFallbackVoter(user),
        warning: getFirebaseServiceUnavailableMessage()
      });
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  let user: Awaited<ReturnType<typeof verifyRequestUser>> = null;
  let voterRef: Awaited<ReturnType<typeof getCurrentUserRecord>>["voterRef"] = null;
  let existing: Awaited<ReturnType<typeof getCurrentUserRecord>>["existing"] = null;

  try {
    ({ user, voterRef, existing } = await getCurrentUserRecord(request));
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return NextResponse.json(
        {
          error: getFirebaseServiceUnavailableMessage()
        },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!voterRef) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: string;
        phone?: string;
        dateOfBirth?: string;
        constituencyId?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        profileImageDataUrl?: string | null;
      }
    | null;

  try {
    await voterRef.set(
      {
        uid: user.uid,
        email: user.email || "",
        displayName: body?.displayName || existing?.data()?.displayName || "",
        phone: body?.phone || existing?.data()?.phone || "",
        dateOfBirth: body?.dateOfBirth || existing?.data()?.dateOfBirth || "",
        constituencyId: body?.constituencyId || existing?.data()?.constituencyId || "",
        addressLine1: body?.addressLine1 || existing?.data()?.addressLine1 || "",
        addressLine2: body?.addressLine2 || existing?.data()?.addressLine2 || "",
        city: body?.city || existing?.data()?.city || "",
        state: body?.state || existing?.data()?.state || "",
        postalCode: body?.postalCode || existing?.data()?.postalCode || "",
        country: body?.country || existing?.data()?.country || "India",
        profileImageDataUrl:
          typeof body?.profileImageDataUrl === "string" || body?.profileImageDataUrl === null
            ? body.profileImageDataUrl
            : existing?.data()?.profileImageDataUrl || null,
        role: existing?.data()?.role || "voter",
        status: existing?.data()?.status || "pending",
        emailVerified: user.emailVerified,
        eligibleElectionIds: existing?.data()?.eligibleElectionIds || [],
        verificationStatus: existing?.data()?.verificationStatus || "unsubmitted",
        createdAt: existing?.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const saved = await voterRef.get();
    const savedData = saved.data();
    const shouldNotifyAdmin = Boolean(
      user.email &&
      (savedData?.verificationStatus === "submitted" || savedData?.verificationStatus === "under_review")
    );
    if (shouldNotifyAdmin) {
      void sendVerificationPendingAdminEmail({
        adminEmail: ADMIN_EMAIL,
        voterEmail: user.email || "",
        voterName: body?.displayName || savedData?.displayName || "",
        constituencyId: body?.constituencyId || savedData?.constituencyId || ""
      }).catch(() => null);
    }
    return NextResponse.json({ voter: serializeVoter(saved.id, savedData) });
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return NextResponse.json(
        {
          error: getFirebaseServiceUnavailableMessage()
        },
        { status: 503 }
      );
    }

    throw error;
  }
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof verifyRequestUser>> = null;
  let voterRef: Awaited<ReturnType<typeof getCurrentUserRecord>>["voterRef"] = null;
  let existing: Awaited<ReturnType<typeof getCurrentUserRecord>>["existing"] = null;

  try {
    ({ user, voterRef, existing } = await getCurrentUserRecord(request));
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return NextResponse.json(
        {
          error: getFirebaseServiceUnavailableMessage()
        },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!voterRef) {
    return NextResponse.json({ error: "Firebase Admin is not available." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: string;
        phone?: string;
        dateOfBirth?: string;
        constituencyId?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        documentType?: string;
        documentNumber?: string;
        aadhaarNumber?: string;
        voterIdNumber?: string;
        documentUrl?: string;
        addressProofUrl?: string;
        profileImageDataUrl?: string | null;
        selfieImageDataUrl?: string | null;
        notes?: string;
      }
    | null;

  if (!body?.documentType || !body.documentNumber || !body.documentUrl || !body.aadhaarNumber || !body.voterIdNumber) {
    return NextResponse.json(
      { error: "Document type, document number, Aadhaar number, voter id number, and document URL are required." },
      { status: 400 }
    );
  }

  try {
    await voterRef.set(
      {
        uid: user.uid,
        email: user.email || "",
        displayName: body.displayName || existing?.data()?.displayName || "",
        phone: body.phone || existing?.data()?.phone || "",
        dateOfBirth: body.dateOfBirth || existing?.data()?.dateOfBirth || "",
        constituencyId: body.constituencyId || existing?.data()?.constituencyId || "",
        addressLine1: body.addressLine1 || existing?.data()?.addressLine1 || "",
        addressLine2: body.addressLine2 || existing?.data()?.addressLine2 || "",
        city: body.city || existing?.data()?.city || "",
        state: body.state || existing?.data()?.state || "",
        postalCode: body.postalCode || existing?.data()?.postalCode || "",
        country: body.country || existing?.data()?.country || "India",
        profileImageDataUrl:
          typeof body.profileImageDataUrl === "string" || body.profileImageDataUrl === null
            ? body.profileImageDataUrl
            : existing?.data()?.profileImageDataUrl || null,
        role: existing?.data()?.role || "voter",
        status: "pending",
        emailVerified: user.emailVerified,
        eligibleElectionIds: existing?.data()?.eligibleElectionIds || [],
        verificationStatus: "submitted",
        verification: {
          documentType: body.documentType,
          documentNumberMasked: maskDocumentNumber(body.documentNumber),
          documentNumberHash: hashDocumentNumber(body.documentNumber),
          documentUrl: body.documentUrl,
          aadhaarMasked: maskDocumentNumber(body.aadhaarNumber),
          aadhaarHash: hashDocumentNumber(body.aadhaarNumber),
          voterIdMasked: maskDocumentNumber(body.voterIdNumber),
          voterIdHash: hashDocumentNumber(body.voterIdNumber),
          selfieImageDataUrl: body.selfieImageDataUrl || existing?.data()?.verification?.selfieImageDataUrl || null,
          addressProofUrl: body.addressProofUrl || "",
          notes: body.notes || "",
          submittedAt: FieldValue.serverTimestamp(),
          reviewedAt: null,
          reviewedBy: null
        },
        createdAt: existing?.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const saved = await voterRef.get();
    return NextResponse.json({ voter: serializeVoter(saved.id, saved.data()) });
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      return NextResponse.json(
        {
          error: getFirebaseServiceUnavailableMessage()
        },
        { status: 503 }
      );
    }

    throw error;
  }
}
