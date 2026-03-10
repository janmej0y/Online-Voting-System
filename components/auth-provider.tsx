"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const value: AuthContextValue = {
    user,
    loading,
    configured: Boolean(auth),
    async signInWithGoogle() {
      if (!auth) throw new Error("Firebase Auth is not configured.");
      await signInWithPopup(auth, getGoogleProvider());
    },
    async signInWithEmail(email, password) {
      if (!auth) throw new Error("Firebase Auth is not configured.");
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signUpWithEmail(email, password) {
      if (!auth) throw new Error("Firebase Auth is not configured.");
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
      await reload(credential.user);
      setUser(auth.currentUser);
    },
    async resetPassword(email) {
      if (!auth) throw new Error("Firebase Auth is not configured.");
      await sendPasswordResetEmail(auth, email);
    },
    async resendVerification() {
      if (!auth?.currentUser) throw new Error("No signed-in user found.");
      await sendEmailVerification(auth.currentUser);
      await reload(auth.currentUser);
      setUser(auth.currentUser);
    },
    async refreshUser() {
      if (!auth?.currentUser) return;
      await reload(auth.currentUser);
      setUser(auth.currentUser);
    },
    async logout() {
      if (!auth) return;
      await signOut(auth);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
