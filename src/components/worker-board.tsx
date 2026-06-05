"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import type { Booking } from "@/lib/types";
import { formatDisplayDate } from "@/lib/date";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

export function WorkerBoard({ initialBookings }: { initialBookings: Booking[] }) {
  const { language, dir, t } = useLanguage();
  const [bookings, setBookings] = useState(initialBookings);
  const activeBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.bookingStatus !== "Cancelled" && booking.bookingStatus !== "Completed")
        .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.area.localeCompare(b.area)),
    [bookings]
  );

  async function markWashed(booking: Booking) {
    const response = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingStatus: "Completed" })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { booking: Booking };
    setBookings((current) => current.map((item) => (item.id === booking.id ? payload.booking : item)));
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-5 dark:bg-slate-950" dir={dir}>
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-sky-700">{t("brand")}</p>
            <h1 className="text-3xl font-black text-slate-950 dark:text-white">{t("workerBoard")}</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
              <ExternalLink className="h-4 w-4" />
              {t("adminDashboard")}
            </Link>
            <LanguageSwitcher />
          </div>
        </header>

        <section className="mt-5 grid gap-3">
          {activeBookings.length === 0 ? <div className="rounded-[8px] bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{t("noBookings")}</div> : null}
          {activeBookings.map((booking) => (
            <article key={booking.id} className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-sky-700">{booking.id}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{booking.phoneNumber}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200">{formatDisplayDate(booking.bookingDate, language)}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                <p><strong>{t("carInfo")}:</strong> {booking.carBrand} {booking.carModel} - {booking.carColor}{booking.plateNumber ? ` - ${booking.plateNumber}` : ""}</p>
                <p><strong>{t("assignedArea")}:</strong> {booking.areaName || booking.area}</p>
                <p><strong>{t("detailedAddress")}:</strong> {booking.address || "-"} {booking.buildingNumber ? `, ${booking.buildingNumber}` : ""}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {booking.carLocation ? (
                  <a href={booking.carLocation} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
                    <MapPin className="h-4 w-4" />
                    {t("carLocation")}
                  </a>
                ) : null}
                <a href={`https://wa.me/20${booking.phoneNumber.replace(/^0/, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <button type="button" onClick={() => markWashed(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                  <Check className="h-4 w-4" />
                  {t("washDone")}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
