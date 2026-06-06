import { BurnoutLoader } from "@/components/burnout-loader";

export default function Loading() {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <BurnoutLoader label="VAYAX is getting ready" />
    </main>
  );
}
