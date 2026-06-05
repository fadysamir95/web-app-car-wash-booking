"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowRight, Clock, Loader2, MapPin, MessageCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { BookingForm } from "@/components/booking-form";
import { DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import type { Booking } from "@/lib/types";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

export function HomePage() {
  const { language, dir, t } = useLanguage();

  return (
    <main dir={dir}>
      <section className="relative min-h-[92svh] overflow-hidden">
        <Image
          src="/images/hero-car-wash.png"
          alt="Clean car at night ready for mobile car wash service"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/56 to-sky-950/20 rtl:bg-gradient-to-l" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-8">
          <header className="col-span-full flex items-center justify-between">
            <Link href="/" className="text-sm font-black text-white">
              {t("brand")}
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </header>

          <div className="flex min-h-[38svh] flex-col justify-center pb-2 pt-8 text-white lg:min-h-[78svh]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-sm font-bold ring-1 ring-white/20">
              <Sparkles className="h-4 w-4 text-sky-200" />
              {t("heroBadge")}
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] sm:text-5xl lg:text-6xl">{t("heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-100 sm:text-lg">{t("heroCopy")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#booking" className="inline-flex h-12 items-center gap-2 rounded-[8px] bg-sky-500 px-5 text-sm font-black text-white shadow-lg shadow-sky-950/25 transition hover:bg-sky-400">
                {t("cta")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </a>
              <Link href="/my-booking" className="inline-flex h-12 items-center gap-2 rounded-[8px] bg-white/12 px-5 text-sm font-black text-white ring-1 ring-white/25 transition hover:bg-white/18">
                {t("myBookings")}
              </Link>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
              <Fact icon={<Clock className="h-4 w-4" />} title={language === "ar" ? DEFAULT_SERVICE.bookingWindowAr : DEFAULT_SERVICE.bookingWindow} />
              <Fact icon={<MapPin className="h-4 w-4" />} title={`${SERVICE_AREAS.length} ${t("supportedAreas")}`} />
              <Fact icon={<ShieldCheck className="h-4 w-4" />} title={`${SERVICE_CONFIG.maxBookingsPerDay} ${t("perDay")}`} />
            </div>
          </div>
          <div className="pb-10 lg:flex lg:items-end lg:pb-4">
            <BookingForm />
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-8 dark:bg-slate-900 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <MyBookings />
        </div>
      </section>

      <section className="bg-white px-4 py-8 dark:bg-slate-950 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-xl font-black text-slate-950 dark:text-white">{t("supportedAreas")}</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {SERVICE_AREAS.map((area) => (
              <div key={area.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-black uppercase text-sky-700">{t("area")}</p>
                <h3 className="mt-2 text-lg font-black text-slate-950 dark:text-white">{area.name[language]}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">{area.priceEgp} EGP</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MyBookings() {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function searchBookings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(`/api/bookings?query=${encodeURIComponent(query.trim())}`);
      const payload = (await response.json()) as { bookings: Booking[] };
      setBookings(payload.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-950 sm:p-6">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-sky-700">{t("myBookings")}</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{t("findMyBooking")}</h2>
        </div>
        <form onSubmit={searchBookings} className="grid gap-2 sm:grid-cols-[280px_auto]">
          <input
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("bookingLookupPlaceholder")}
            aria-label={t("bookingLookupPlaceholder")}
          />
          <button type="submit" disabled={loading || query.trim().length < 3} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white disabled:bg-slate-400">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("searchBooking")}
          </button>
        </form>
      </div>

      <div className="mt-4 grid gap-3">
        {bookings.map((booking) => (
          <BookingLookupCard key={booking.id} booking={booking} language={language} />
        ))}
        {searched && !loading && bookings.length === 0 ? <p className="rounded-[8px] bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-900">{t("noBookingFound")}</p> : null}
      </div>
    </div>
  );
}

function BookingLookupCard({ booking, language }: { booking: Booking; language: "en" | "ar" }) {
  const { t } = useLanguage();
  const finalPrice = useMemo(() => {
    if (typeof booking.finalPriceEgp === "number") return booking.finalPriceEgp;
    const promo = booking.promoCode ? PROMO_CODES.find((item) => item.code === booking.promoCode) : null;
    return Math.max(DEFAULT_SERVICE.priceEgp - (promo?.discountEgp || 0), 0);
  }, [booking.finalPriceEgp, booking.promoCode]);
  const whatsAppUrl = useMemo(() => {
    const message =
      language === "ar"
        ? `مرحبًا، لقد قمت بتحويل رسوم حجز غسيل السيارة.\nرقم الحجز: ${booking.id}\nالاسم: ${booking.customerName}\nرقم الهاتف: ${booking.phoneNumber}`
        : `Hello, I have completed the payment for my car wash booking.\nBooking Reference: ${booking.id}\nName: ${booking.customerName}\nPhone: ${booking.phoneNumber}`;
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking, language]);

  return (
    <article className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="text-sm leading-6 text-slate-700 dark:text-slate-200">
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{booking.customerName}</h3>
          <p><strong>{t("bookingReference")}:</strong> {booking.id}</p>
          <p><strong>{t("bookingDate")}:</strong> {formatDisplayDate(booking.bookingDate, language)}</p>
          <p><strong>{t("area")}:</strong> {booking.areaName || booking.area}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <strong>{t("bookingStatus")}:</strong>
            <BookingStatusBadge status={booking.bookingStatus} language={language} />
          </p>
          <p><strong>{t("servicePrice")}:</strong> {finalPrice} EGP</p>
        </div>
        {finalPrice > 0 ? (
          <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
            <MessageCircle className="h-4 w-4" />
            {t("sendScreenshot")}
          </a>
        ) : null}
      </div>
    </article>
  );
}

function BookingStatusBadge({ status, language }: { status: string; language: "en" | "ar" }) {
  const normalized = normalizeBookingStatus(status);
  const classes = {
    Pending: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
    Confirmed: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
    Completed: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
    Cancelled: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900"
  } as const;

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-black ring-1 ${classes[normalized]}`}>
      {bookingStatusLabel(normalized, language)}
    </span>
  );
}

function normalizeBookingStatus(status: string) {
  if (status === "Pending Payment" || status === "Payment Under Review") return "Pending";
  if (status === "Scheduled") return "Confirmed";
  if (status === "Pending" || status === "Confirmed" || status === "Completed" || status === "Cancelled") return status;
  return "Pending";
}

function bookingStatusLabel(status: string, language: "en" | "ar") {
  const normalized = normalizeBookingStatus(status);
  const labels = {
    en: {
      Pending: "Pending",
      Confirmed: "Confirmed",
      Completed: "Completed",
      Cancelled: "Cancelled",
      Scheduled: "Confirmed"
    },
    ar: {
      Pending: "معلق",
      Confirmed: "مؤكد",
      Completed: "تم الغسيل",
      Cancelled: "ملغي",
      Scheduled: "مؤكد"
    }
  } as const;

  return labels[language][normalized];
}

function Fact({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-white/10 px-3 py-2 ring-1 ring-white/15">
      {icon}
      <span className="font-bold">{title}</span>
    </div>
  );
}
