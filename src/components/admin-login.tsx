"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    setLoading(false);

    if (!response.ok) {
      setError("Invalid admin password.");
      return;
    }

    window.location.reload();
  }

  return (
    <main className="grid min-h-svh place-items-center bg-slate-950 px-4">
      <form onSubmit={login} className="glass-panel w-full max-w-sm rounded-[8px] p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-sky-600 text-white">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Admin dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to manage bookings and payment status.</p>
        <label className="mt-5 block">
          <span className="label">Password</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-sky-600 text-sm font-black text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Sign in
        </button>
      </form>
    </main>
  );
}
