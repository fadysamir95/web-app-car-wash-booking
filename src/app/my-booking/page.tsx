"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MessageCircle, Search } from "lucide-react";
import { DEFAULT_SERVICE, PROMO_CODES, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import type { Booking } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function MyBookingPage() {
  const { language, dir, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(`/api/bookings?query=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const payload = (await response.json()) as { bookings: Booking[] };
      setBookings(payload.bookings || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-5 dark:bg-slate-950" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/" className="text-sm font-black text-slate-950 dark:text-white">{t("brand")}</Link>
          <LanguageSwitcher />
        </header>

        <section className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
          <p className="text-sm font-black uppercase text-sky-700">{t("myBookings")}</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{t("findMyBooking")}</h1>
          <form onSubmit={search} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("bookingLookupPlaceholder")} />
            <button type="submit" disabled={loading || query.trim().length < 3} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-5 text-sm font-black text-white disabled:bg-slate-400">
              <Search className="h-4 w-4" />
              {t("searchBooking")}
            </button>
          </form>
        </section>

        <div className="mt-4 grid gap-4">
          {bookings.map((booking) => <BookingDetails key={booking.id} booking={booking} language={language} />)}
          {searched && !loading && bookings.length === 0 ? <div className="rounded-[8px] bg-white p-6 text-sm font-bold text-slate-500 dark:bg-slate-900">{t("noBookingFound")}</div> : null}
        </div>
      </div>
    </main>
  );
}

function BookingDetails({ booking, language }: { booking: Booking; language: "en" | "ar" }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(0);
  const finalPrice = useMemo(() => {
    if (typeof booking.finalPriceEgp === "number") return booking.finalPriceEgp;
    const promo = booking.promoCode ? PROMO_CODES.find((item) => item.code === booking.promoCode) : null;
    return Math.max(DEFAULT_SERVICE.priceEgp - (promo?.discountEgp || 0), 0);
  }, [booking.finalPriceEgp, booking.promoCode]);
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const remainingMs = expiresAt && now > 0 ? Math.max(expiresAt - now, 0) : null;
  const canPay = finalPrice > 0 && booking.bookingStatus === "Pending" && remainingMs !== 0;
  const whatsAppUrl = useMemo(() => {
    const message =
      language === "ar"
        ? `مرحبًا، لقد قمت بتحويل رسوم حجز غسيل السيارة.\nرقم الحجز: ${booking.id}\nالاسم: ${booking.customerName}\nرقم الهاتف: ${booking.phoneNumber}`
        : `Hello, I have completed the payment for my car wash booking.\nBooking Reference: ${booking.id}\nName: ${booking.customerName}\nPhone: ${booking.phoneNumber}`;
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking, language]);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <article className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-sky-700">{t("bookingReference")}: {booking.id}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{booking.phoneNumber}</p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200">{bookingStatusLabel(booking.bookingStatus, language)}</span>
      </div>

      <div className="mt-4 grid gap-3 rounded-[8px] bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:grid-cols-2">
        <p><strong>{t("bookingDate")}:</strong> {formatDisplayDate(booking.bookingDate, language)}</p>
        <p><strong>{t("area")}:</strong> {booking.areaName || booking.area}</p>
        <p><strong>{t("carInfo")}:</strong> {booking.carBrand} {booking.carModel} - {booking.carColor}</p>
        <p><strong>{t("servicePrice")}:</strong> {finalPrice} EGP</p>
      </div>

      {remainingMs !== null && booking.bookingStatus === "Pending" ? (
        <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
          <Clock className="h-4 w-4" />
          {remainingMs > 0 ? `${t("paymentCountdown")}: ${formatCountdown(remainingMs)}` : t("bookingExpired")}
        </div>
      ) : null}

      {booking.cancellationReason ? <p className="mt-4 rounded-[8px] bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{booking.cancellationReason}</p> : null}

      {canPay ? (
        <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
          <MessageCircle className="h-4 w-4" />
          {t("sendScreenshot")}
        </a>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-black text-slate-950 dark:text-white">{t("bookingTimeline")}</h3>
        <div className="mt-3 grid gap-2">
          {(booking.timeline || []).map((item) => (
            <div key={`${item.status}-${item.createdAt}`} className="rounded-[8px] border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-black text-slate-950 dark:text-white">{timelineLabel(item.label, language)}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
              {item.note ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.note}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, "0")).join(":");
}

function bookingStatusLabel(status: string, language: "en" | "ar") {
  const labels = {
    en: { Pending: "Pending", Confirmed: "Confirmed", Completed: "Vehicle washed", Cancelled: "Cancelled" },
    ar: { Pending: "معلق", Confirmed: "مؤكد", Completed: "تم الغسيل", Cancelled: "ملغي" }
  } as const;
  return labels[language][status as keyof typeof labels.en] || status;
}

function timelineLabel(label: string, language: "en" | "ar") {
  if (language === "en") return label;
  const labels: Record<string, string> = {
    "Booking submitted": "تم إرسال الحجز",
    "Booking confirmed": "تم تأكيد الحجز",
    "Auto cancelled": "تم الإلغاء تلقائيًا",
    "Status changed to Pending": "تم تغيير الحالة إلى معلق",
    "Status changed to Confirmed": "تم تغيير الحالة إلى مؤكد",
    "Status changed to Completed": "تم تغيير الحالة إلى تم الغسيل",
    "Status changed to Cancelled": "تم تغيير الحالة إلى ملغي"
  };
  return labels[label] || label;
}
