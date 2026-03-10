export function isFirestoreUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message || "";
  const details = JSON.stringify(error, Object.getOwnPropertyNames(error));

  return (
    message.includes("Cloud Firestore API has not been used") ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("SERVICE_DISABLED") ||
    details.includes("firestore.googleapis.com") ||
    details.includes("SERVICE_DISABLED")
  );
}

export function getFirebaseServiceUnavailableMessage() {
  return "Cloud Firestore is not enabled for the configured Firebase project yet. Enable the Firestore API and retry.";
}
