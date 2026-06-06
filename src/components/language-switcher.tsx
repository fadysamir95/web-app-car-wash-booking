"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "./language-provider";

export function LanguageSwitcher({ variant = "glass" }: { variant?: "glass" | "surface" }) {
  const { language, setLanguage } = useLanguage();
  const next = language === "en" ? "ar" : "en";
  const className =
    variant === "surface"
      ? "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-sky-200 bg-sky-50 px-3 text-sm font-black text-sky-950 shadow-sm transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-100 dark:hover:bg-sky-900"
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
