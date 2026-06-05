"use client";

import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-950 px-4 text-white">
      <div className="max-w-md rounded-[8px] bg-white p-6 text-slate-950 dark:bg-slate-900 dark:text-white">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-2xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Please retry. If the issue continues, check the server logs.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-11 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
