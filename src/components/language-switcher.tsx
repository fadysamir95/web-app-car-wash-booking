"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "./language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const next = language === "en" ? "ar" : "en";

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white/14 px-3 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/20 dark:bg-slate-900/70"
      aria-label="Change language"
    >
      <Languages className="h-4 w-4" />
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
