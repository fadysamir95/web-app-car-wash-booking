"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, MessageCircle, Search, WalletCards } from "lucide-react";
import { PROMO_CODES, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import { bookingFinalPrice } from "@/lib/pricing";
import type { Booking } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

export default function MyBookingPage() {
  const { language, dir, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim();
    if (!ref || ref.length < 3) return;
    queueMicrotask(() => {
      setQuery(ref);
      setLoading(true);
      setSearched(true);
      fetch(`/api/bookings?query=${encodeURIComponent(ref)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { bookings: Booking[] }) => setBookings(payload.bookings || []))
        .finally(() => setLoading(false));
    });
  }, []);

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
          <div className="flex items-center gap-2">
            <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-white px-3 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t("backToHome")}
            </Link>
            <LanguageSwitcher variant="surface" />
          </div>
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
  const [currentBooking, setCurrentBooking] = useState(booking);
  const [now, setNow] = useState(0);
  const finalPrice = bookingFinalPrice(currentBooking, PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })));
  const expiresAt = currentBooking.expiresAt ? new Date(currentBooking.expiresAt).getTime() : null;
  const remainingMs = expiresAt && now > 0 ? Math.max(expiresAt - now, 0) : null;
  const isPendingPaidBooking = finalPrice > 0 && currentBooking.bookingStatus === "Pending";
  const countdownReady = !expiresAt || now > 0;
  const hasActiveCountdown = Boolean(remainingMs && remainingMs > 0);
  const showInstapay = isPendingPaidBooking && countdownReady && hasActiveCountdown;
  const showPaymentScreenshot = isPendingPaidBooking && countdownReady && !hasActiveCountdown;
  const instapayUrl = `instapay://pay?phone=${SERVICE_CONFIG.paymentPhone}&amount=${finalPrice}`;
  const whatsAppUrl = useMemo(() => {
    const message =
      language === "ar"
        ? `مرحبًا، لقد قمت بتحويل رسوم حجز غسيل السيارة.\nرقم الحجز: ${currentBooking.id}\nالاسم: ${currentBooking.customerName}\nرقم الهاتف: ${currentBooking.phoneNumber}`
        : `Hello, I have completed the payment for my car wash booking.\nBooking Reference: ${currentBooking.id}\nName: ${currentBooking.customerName}\nPhone: ${currentBooking.phoneNumber}`;
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [currentBooking, language]);

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
          <p className="text-xs font-black uppercase text-sky-700">{t("bookingReference")}: {currentBooking.id}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{currentBooking.customerName}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{currentBooking.phoneNumber}</p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200">{bookingStatusLabel(currentBooking.bookingStatus, language)}</span>
      </div>

      <div className="mt-4 grid gap-3 rounded-[8px] bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:grid-cols-2">
        <p><strong>{t("bookingDate")}:</strong> {formatDisplayDate(currentBooking.bookingDate, language)}</p>
        <p><strong>{t("area")}:</strong> {currentBooking.areaName || currentBooking.area}</p>
        <p><strong>{t("carInfo")}:</strong> {currentBooking.carBrand} {currentBooking.carModel} - {currentBooking.carColor}</p>
        <p><strong>{t("servicePrice")}:</strong> {finalPrice} EGP</p>
      </div>

      {remainingMs !== null && currentBooking.bookingStatus === "Pending" ? (
        <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
          <Clock className="h-4 w-4" />
          {remainingMs > 0 ? `${t("paymentCountdown")}: ${formatCountdown(remainingMs)}` : t("bookingExpired")}
        </div>
      ) : null}

      {currentBooking.cancellationReason ? <p className="mt-4 rounded-[8px] bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{currentBooking.cancellationReason}</p> : null}

      {showInstapay ? (
        <a href={instapayUrl} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
          <WalletCards className="h-4 w-4" />
          {t("openInstapay")}
        </a>
      ) : null}

      {showPaymentScreenshot ? (
        <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
          <MessageCircle className="h-4 w-4" />
          {t("sendScreenshot")}
        </a>
      ) : null}

      {currentBooking.bookingStatus === "Completed" ? (
        <RatingForm booking={currentBooking} onRated={setCurrentBooking} />
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-black text-slate-950 dark:text-white">{t("bookingTimeline")}</h3>
        <div className="mt-3 grid gap-2">
          {(currentBooking.timeline || []).map((item) => (
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

function RatingForm({ booking, onRated }: { booking: Booking; onRated: (booking: Booking) => void }) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(booking.rating || 5);
  const [ratingComment, setRatingComment] = useState(booking.ratingComment || "");
  const [complaint, setComplaint] = useState(booking.complaint?.text || "");
  const [saving, setSaving] = useState(false);

  async function submitRating() {
    setSaving(true);
    const response = await fetch(`/api/bookings/${booking.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, ratingComment })
    });
    const payload = (await response.json().catch(() => ({}))) as { booking?: Booking };
    setSaving(false);
    if (response.ok && payload.booking) onRated(payload.booking);
  }

  async function submitComplaint() {
    setSaving(true);
    const response = await fetch(`/api/bookings/${booking.id}/complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaint })
    });
    const payload = (await response.json().catch(() => ({}))) as { booking?: Booking };
    setSaving(false);
    if (response.ok && payload.booking) onRated(payload.booking);
  }

  if (booking.rating) {
    return (
      <div className="mt-4 rounded-[8px] border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
        <p>{t("ratingThanks")} - {booking.rating}/5</p>
        {booking.rating < 3 && !booking.complaint ? (
          <div className="mt-4 rounded-[8px] bg-white p-3 dark:bg-slate-900">
            <p className="text-sm font-black text-slate-950 dark:text-white">Tell us what happened so we can fix it.</p>
            <textarea className="field mt-3 min-h-24" value={complaint} onChange={(event) => setComplaint(event.target.value)} placeholder="Write your complaint here" />
            <button type="button" onClick={submitComplaint} disabled={saving || complaint.trim().length < 10} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-rose-600 px-4 text-sm font-black text-white disabled:opacity-60">
              Send complaint
            </button>
          </div>
        ) : null}
        {booking.complaint ? <p className="mt-3 rounded-[8px] bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">Complaint received. We will contact you soon.</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[8px] border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/35">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">{t("rateService")}</h3>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRating(item)}
            className={`h-10 w-10 rounded-[8px] text-sm font-black ${item <= rating ? "bg-sky-600 text-white" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-200"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <textarea className="field mt-3 min-h-24" value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} placeholder={t("ratingComment")} />
      <button type="button" onClick={submitRating} disabled={saving} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white disabled:opacity-60">
        {saving ? t("checking") : t("submitRating")}
      </button>
    </div>
  );
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
