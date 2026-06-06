"use client";

import { FormEvent, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";
import { BrandLogo } from "./brand-logo";

export function WorkerLogin() {
  const { dir, t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/worker/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    setLoading(false);

    if (!response.ok) {
      setError(t("invalidPassword"));
      return;
    }

    window.location.reload();
  }

  return (
    <main className="grid min-h-svh place-items-center bg-slate-950 px-4" dir={dir}>
      <form onSubmit={login} className="glass-panel w-full max-w-sm rounded-[8px] p-6">
        <div className="flex items-center justify-between">
          <BrandLogo compact size="lg" bare />
          <LanguageSwitcher variant="surface" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{t("workerBoard")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t("signIn")}</p>
        <label className="mt-5 block">
          <span className="label">{t("password")}</span>
          <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-sky-600 text-sm font-black text-white disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {t("signIn")}
        </button>
      </form>
    </main>
  );
}
