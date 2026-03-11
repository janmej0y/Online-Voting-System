"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Locale = "en" | "hi" | "bn";

const dictionary = {
  en: {
    profile: "Profile",
    verification: "Verification",
    vote: "Vote",
    results: "Results",
    proof: "Proof",
    menu: "Menu",
    helpPrivacy: "Help & privacy",
    language: "Language"
  },
  hi: {
    profile: "प्रोफ़ाइल",
    verification: "सत्यापन",
    vote: "मतदान",
    results: "परिणाम",
    proof: "प्रमाण",
    menu: "मेन्यू",
    helpPrivacy: "सहायता और गोपनीयता",
    language: "भाषा"
  },
  bn: {
    profile: "প্রোফাইল",
    verification: "যাচাই",
    vote: "ভোট",
    results: "ফলাফল",
    proof: "প্রমাণ",
    menu: "মেনু",
    helpPrivacy: "সহায়তা ও গোপনীয়তা",
    language: "ভাষা"
  }
} satisfies Record<Locale, Record<string, string>>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof (typeof dictionary)["en"]) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ezeevote-locale");
    if (stored === "en" || stored === "hi" || stored === "bn") {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ezeevote-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t(key) {
        return dictionary[locale][key];
      }
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider.");
  return context;
}
