"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Locale = "en" | "hi";

const dictionary = {
  en: {
    profile: "Profile",
    verification: "Verification",
    vote: "Vote",
    results: "Results",
    proof: "Proof",
    menu: "Menu",
    helpPrivacy: "Help & privacy"
  },
  hi: {
    profile: "प्रोफ़ाइल",
    verification: "सत्यापन",
    vote: "मतदान",
    results: "परिणाम",
    proof: "प्रमाण",
    menu: "मेनू",
    helpPrivacy: "सहायता और गोपनीयता"
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
