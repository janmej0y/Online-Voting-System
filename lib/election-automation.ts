import { FieldValue } from "firebase-admin/firestore";

import { isFirestoreUnavailableError } from "@/lib/firebase-errors";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function syncElectionSchedules() {
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) return;

  const snapshot = await adminDb
    .collection("elections")
    .get()
    .catch((error) => {
      if (isFirestoreUnavailableError(error)) return null;
      throw error;
    });
  if (!snapshot) return;
  if (snapshot.empty) return;

  const now = new Date();
  const batch = adminDb.batch();
  let hasChanges = false;
  let activeElectionId: string | null = null;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const startsAt = parseDate(data.startsAt);
    const endsAt = parseDate(data.endsAt);
    let nextStatus = data.status;
    let allowVoting = Boolean(data.allowVoting);
    let isActive = Boolean(data.isActive);

    if (startsAt && now < startsAt && data.status !== "closed" && data.status !== "certified") {
      nextStatus = "scheduled";
      allowVoting = false;
      isActive = false;
    }

    if (startsAt && now >= startsAt && (!endsAt || now <= endsAt) && data.status !== "closed" && data.status !== "certified") {
      nextStatus = "active";
      allowVoting = true;
      isActive = true;
      activeElectionId = doc.id;
    }

    if (endsAt && now > endsAt && data.status !== "closed" && data.status !== "certified") {
      nextStatus = "closed";
      allowVoting = false;
      isActive = false;
    }

    if (nextStatus !== data.status || allowVoting !== data.allowVoting || isActive !== data.isActive) {
      batch.set(
        doc.ref,
        {
          status: nextStatus,
          allowVoting,
          isActive,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      hasChanges = true;
    }
  });

  if (activeElectionId) {
    batch.set(
      adminDb.collection("system").doc("public"),
      { activeElectionId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    hasChanges = true;
  }

  if (hasChanges) {
    await batch.commit().catch((error) => {
      if (isFirestoreUnavailableError(error)) return;
      throw error;
    });
  }
}
