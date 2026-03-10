import { readFileSync } from "fs";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function getPrivateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") || null;
}

function readServiceAccountFile(): ServiceAccountShape | null {
  const path = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (!path) return null;

  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as ServiceAccountShape;
  } catch {
    return null;
  }
}

function getServiceAccount() {
  const fileAccount = readServiceAccountFile();

  return {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || fileAccount?.project_id || null,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || fileAccount?.client_email || null,
    privateKey: getPrivateKey() || fileAccount?.private_key || null
  };
}

export function isFirebaseAdminConfigured() {
  const serviceAccount = getServiceAccount();
  return Boolean(serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey);
}

export function getFirebaseAdminApp() {
  if (!isFirebaseAdminConfigured()) return null;

  const serviceAccount = getServiceAccount();

  return getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: serviceAccount.projectId || undefined,
          clientEmail: serviceAccount.clientEmail || undefined,
          privateKey: serviceAccount.privateKey || undefined
        })
      });
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseAdminDb() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}
