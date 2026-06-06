"use client";

import { useMemo, useState } from "react";
import { Check, LogOut, Map, MapPin, MessageCircle } from "lucide-react";
import type { Booking, PublicWorker } from "@/lib/types";
import { SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";
import { BrandLogo } from "./brand-logo";

const ISSUE_REASONS = ["لم أجد السيارة", "العنوان غير واضح", "ممنوع الدخول"];

export function WorkerBoard({ initialBookings, worker }: { initialBookings: Booking[]; worker: PublicWorker | null }) {
  const { language, dir, t } = useLanguage();
  const [bookings, setBookings] = useState(initialBookings);
  const [proofs, setProofs] = useState<Record<string, { imageName: string; imageDataUrl: string }>>({});
  const [issueReasons, setIssueReasons] = useState<Record<string, string>>({});
  const routeTotal = useMemo(() => initialBookings.filter((booking) => booking.bookingStatus !== "Cancelled").length, [initialBookings]);
  const completedCount = useMemo(() => bookings.filter((booking) => booking.bookingStatus === "Completed").length, [bookings]);
  const activeBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.bookingStatus !== "Cancelled" && booking.bookingStatus !== "Completed")
        .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.area.localeCompare(b.area)),
    [bookings]
  );
  const routeUrl = useMemo(() => buildRouteUrl(activeBookings), [activeBookings]);

  async function markWashed(booking: Booking) {
    const proof = proofs[booking.id];
    if (!proof) return;
    const response = await fetch(`/api/worker/bookings/${booking.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof)
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { booking: Booking };
    setBookings((current) => current.map((item) => (item.id === booking.id ? payload.booking : item)));
  }

  async function markIssue(booking: Booking) {
    const reason = issueReasons[booking.id];
    if (!reason) return;
    window.open(buildAdminWhatsAppUrl(booking, worker?.name, reason), "_blank", "noopener,noreferrer");
  }

  async function captureProof(bookingId: string, file: File | null) {
    if (!file) return;
    const imageDataUrl = await compressImageFile(file);
    setProofs((current) => ({ ...current, [bookingId]: { imageName: file.name, imageDataUrl } }));
  }

  async function logout() {
    await fetch("/api/worker/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-5 dark:bg-slate-950" dir={dir}>
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <BrandLogo compact size="lg" bare />
            <h1 className="text-3xl font-black text-slate-950 dark:text-white">{t("workerBoard")}</h1>
            {worker ? <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{worker.name}</p> : null}
          </div>
          <div className="flex gap-2">
            <LanguageSwitcher variant="surface" />
            <button type="button" onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </header>

        <section className="mt-5 grid gap-3 rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-black text-slate-500 dark:text-slate-300">{language === "ar" ? "تقدم الجولة" : "Route progress"}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {completedCount} {language === "ar" ? "من" : "of"} {routeTotal} {language === "ar" ? "غسلة" : "washes"}
            </h2>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 sm:w-56">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${routeTotal ? Math.min(100, (completedCount / routeTotal) * 100) : 0}%` }} />
          </div>
        </section>

        {routeUrl ? (
          <section className="mt-5 rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-sky-700">{t("routePlan")}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{t("optimizedWorkerRoute")}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{activeBookings.length} {t("bookings")}</p>
              </div>
              <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
                <Map className="h-4 w-4" />
                {t("openRouteMap")}
              </a>
            </div>
            <div className="mt-4 grid gap-2">
              {activeBookings.map((booking, index) => (
                <div key={booking.id} className="flex items-center gap-3 rounded-[8px] bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">{index + 1}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{booking.customerName} - {booking.areaName || booking.area}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 grid gap-3">
          {activeBookings.length === 0 ? <div className="rounded-[8px] bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{t("noBookings")}</div> : null}
          {activeBookings.map((booking) => (
            <article key={booking.id} className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-sky-700">{booking.id}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200">{formatDisplayDate(booking.bookingDate, language)}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                <p><strong>{t("carInfo")}:</strong> {booking.carBrand} {booking.carModel} - {booking.carColor}{booking.plateNumber ? ` - ${booking.plateNumber}` : ""}</p>
                <p><strong>{t("assignedArea")}:</strong> {booking.areaName || booking.area}</p>
                <p><strong>{t("detailedAddress")}:</strong> {booking.address || "-"} {booking.buildingNumber ? `, ${booking.buildingNumber}` : ""}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {booking.carLocation ? (
                  <a href={booking.carLocation} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
                    <MapPin className="h-4 w-4" />
                    {t("carLocation")}
                  </a>
                ) : null}
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[8px] bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
                  {proofs[booking.id]?.imageName || (language === "ar" ? "رفع صورة إثبات الغسيل" : "Upload proof photo")}
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => captureProof(booking.id, event.target.files?.[0] || null)} />
                </label>
                <button type="button" disabled={!proofs[booking.id]} onClick={() => markWashed(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-400 dark:bg-white dark:text-slate-950 dark:disabled:bg-slate-700">
                  <Check className="h-4 w-4" />
                  {t("washDone")}
                </button>
              </div>
              <div className="mt-3 grid gap-2 rounded-[8px] bg-amber-50 p-3 dark:bg-amber-950/30 sm:grid-cols-[1fr_auto]">
                <select
                  value={issueReasons[booking.id] || ""}
                  onChange={(event) => setIssueReasons((current) => ({ ...current, [booking.id]: event.target.value }))}
                  className="h-11 rounded-[8px] border border-amber-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">{language === "ar" ? "اختر سبب تعذر التنفيذ" : "Select issue reason"}</option>
                  {ISSUE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                <button type="button" disabled={!issueReasons[booking.id]} onClick={() => markIssue(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-amber-600 px-4 text-sm font-black text-white disabled:bg-slate-400">
                  <MessageCircle className="h-4 w-4" />
                  {language === "ar" ? "إرسال للأدمن" : "Send to admin"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function buildRouteUrl(bookings: Booking[]) {
  const stops = bookings
    .map((booking) => booking.carLocation || [booking.address, booking.areaName].filter(Boolean).join(", "))
    .filter(Boolean)
    .slice(0, 10);

  if (stops.length === 0) return "";
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving"
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildAdminWhatsAppUrl(booking: Booking, workerName?: string, reason?: string) {
  const message = [
    `تنبيه من العامل${workerName ? `: ${workerName}` : ""}`,
    `رقم الحجز: ${booking.id}`,
    `العميل: ${booking.customerName}`,
    `السيارة: ${booking.carBrand} ${booking.carModel} - ${booking.carColor}`,
    `المنطقة: ${booking.areaName || booking.area}`,
    `العنوان: ${[booking.address, booking.buildingNumber].filter(Boolean).join(", ") || "غير متاح"}`,
    booking.carLocation ? `الموقع: ${booking.carLocation}` : "",
    reason ? `سبب تعذر التنفيذ: ${reason}` : "محتاج مساعدة في الوصول أو العنوان."
  ].filter(Boolean).join("\n");

  return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
}

function compressImageFile(file: File, maxSize = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        resolve("");
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(reader.result as string);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.onerror = () => resolve(reader.result as string);
      image.src = reader.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
