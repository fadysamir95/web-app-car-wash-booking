"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "./language-provider";

export function LanguageSwitcher({ variant = "glass" }: { variant?: "glass" | "surface" }) {
  const { language, setLanguage } = useLanguage();
  const next = language === "en" ? "ar" : "en";
  const className =
    variant === "surface"
      ? "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-3 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800 dark:hover:bg-slate-800"
      : "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white/14 px-3 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/20 dark:bg-slate-900/70";

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className={className}
      aria-label="Change language"
    >
      <Languages className="h-4 w-4" />
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
