"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDirection, languages, translations, type Language, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const storageKey = "carwash-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ language: Language; hasPreference: boolean }>(() => {
    if (typeof window === "undefined") return { language: "en", hasPreference: false };
    const saved = window.localStorage.getItem(storageKey) as Language | null;
    if (saved === "en" || saved === "ar") {
      return { language: saved, hasPreference: true };
    }
    return { language: "en", hasPreference: false };
  });
  const { language, hasPreference } = state;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = getDirection(language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const dir = getDirection(language);
    return {
      language,
      dir,
      t: (key) => translations[language][key] || translations.en[key],
      setLanguage: (nextLanguage) => {
        window.localStorage.setItem(storageKey, nextLanguage);
        setState({ language: nextLanguage, hasPreference: true });
      }
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {!hasPreference ? <LanguageSelection onSelect={value.setLanguage} /> : null}
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }
  return context;
}

function LanguageSelection({ onSelect }: { onSelect: (language: Language) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 px-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[8px] bg-white p-5 shadow-2xl dark:bg-slate-900">
        <h1 className="text-center text-2xl font-black text-slate-950 dark:text-white">Choose your language</h1>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => onSelect("en")}
            className="h-14 rounded-[8px] bg-sky-600 text-base font-black text-white"
          >
            🇺🇸 {languages.en.label}
          </button>
          <button
            type="button"
            onClick={() => onSelect("ar")}
            className="h-14 rounded-[8px] bg-slate-950 text-base font-black text-white"
          >
            🇪🇬 {languages.ar.label}
          </button>
        </div>
      </div>
    </div>
  );
}
