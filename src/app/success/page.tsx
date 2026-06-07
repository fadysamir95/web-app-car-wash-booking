"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, Home, ListChecks, MessageCircle, Share2, WalletCards } from "lucide-react";
import { PROMO_CODES, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import { finalPriceFromPromo } from "@/lib/pricing";
import type { Booking, ServiceSettings } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";

export default function SuccessPage() {
  const { language, dir, t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [booking] = useState<Booking | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("latestBooking");
    return raw ? (JSON.parse(raw) as Booking) : null;
  });

  const whatsAppUrl = useMemo(() => {
    const message =
      language === "ar"
        ? `مرحبًا، لقد قمت بتحويل رسوم حجز غسيل السيارة.\nرقم الحجز: ${booking?.id || ""}\nالاسم: ${booking?.customerName || ""}\nرقم الهاتف: ${booking?.phoneNumber || ""}`
        : `Hello, I have completed the payment for my car wash booking.\nBooking Reference: ${booking?.id || ""}\nName: ${booking?.customerName || ""}\nPhone: ${booking?.phoneNumber || ""}`;
    return `https://wa.me/2${settings?.paymentPhone || SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking, language, settings?.paymentPhone]);
  const appliedPromo = booking?.promoCode ? PROMO_CODES.find((promo) => promo.code === booking.promoCode) : null;
  const servicePrice = booking?.finalPriceEgp ?? finalPriceFromPromo(appliedPromo ? { ...appliedPromo, active: true } : null, settings?.servicePriceEgp || undefined);
  const isFreeBooking = servicePrice === 0;
  const remainingMs = booking?.expiresAt && !isFreeBooking && now > 0 ? Math.max(new Date(booking.expiresAt).getTime() - now, 0) : null;
  const paymentWindowMs =
    booking?.expiresAt && booking.createdAt
      ? Math.max(new Date(booking.expiresAt).getTime() - new Date(booking.createdAt).getTime(), 1)
      : 1;
  const paymentProgress = remainingMs === null ? 100 : Math.max(0, Math.min(100, (remainingMs / paymentWindowMs) * 100));
  const trackingPath = booking ? `/my-booking?ref=${encodeURIComponent(booking.id)}` : "/my-booking";
  const trackingUrl = typeof window !== "undefined" ? `${window.location.origin}${trackingPath}` : trackingPath;

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((response) => response.json())
      .then((payload: { settings: ServiceSettings }) => {
        if (!cancelled) setSettings(payload.settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyPaymentNumber() {
    await navigator.clipboard.writeText(settings?.paymentPhone || SERVICE_CONFIG.paymentPhone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyTrackingLink() {
    await navigator.clipboard.writeText(trackingUrl);
    setTrackingCopied(true);
    window.setTimeout(() => setTrackingCopied(false), 1600);
  }

  async function shareTrackingLink() {
    if (navigator.share) {
      await navigator.share({
        title: "VAYAX booking",
        text: language === "ar" ? "رابط تتبع حجز VAYAX" : "VAYAX booking tracking link",
        url: trackingUrl
      });
      return;
    }
    await copyTrackingLink();
  }

  return (
    <main className="min-h-svh bg-slate-950 px-4 py-8 text-white" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" aria-label="VAYAX home">
            <BrandLogo compact dark size="lg" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/my-booking" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15">
              <ListChecks className="h-4 w-4" />
              {t("myBookings")}
            </Link>
            <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15">
              <Home className="h-4 w-4" />
              {t("backToHome")}
            </Link>
            <LanguageSwitcher />
          </div>
        </header>

        <div className="glass-panel rounded-[8px] p-6 text-slate-950 sm:p-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-3xl font-black">{t("successTitle")}</h1>

          <div className="mt-3 space-y-2 leading-7 text-slate-700 dark:text-slate-200">
            <p>{t("successCopy")}</p>
            <p>{t("successReserved")}</p>
            <p>{isFreeBooking ? t("freeBookingMessage") : t("successPaymentPrompt")}</p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <BrandLogo compact size="md" />
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
                {isFreeBooking ? t("bookingConfirmed") : t("pendingPayment")}
              </span>
            </div>
            <div className="grid gap-3 p-4 text-sm text-slate-800 sm:grid-cols-2">
              <ReceiptItem label={t("bookingReference")} value={booking?.id || "-"} strong />
              <ReceiptItem label={t("servicePrice")} value={`${servicePrice} EGP`} strong />
              <ReceiptItem label={t("fullName")} value={booking?.customerName || "-"} />
              <ReceiptItem label={t("phoneNumber")} value={booking?.phoneNumber || "-"} />
              <ReceiptItem label={t("bookingDate")} value={booking ? formatDisplayDate(booking.bookingDate, language) : "-"} />
              <ReceiptItem label={t("area")} value={booking?.areaName || booking?.area || "-"} />
            </div>
            <div className="border-t border-slate-100 bg-sky-50 px-4 py-3 text-sm font-bold text-slate-700">
              {language === "ar" ? "احفظ رقم الحجز أو رابط التتبع لاستخدامه عند إرسال صورة التحويل أو متابعة الحالة." : "Keep your booking reference or tracking link for payment proof and status updates."}
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-[8px] border border-sky-200 bg-sky-50 p-4 text-slate-950">
            <p>
              <strong>{t("servicePrice")}:</strong> {servicePrice} EGP
            </p>
            {!isFreeBooking ? (
              <div className="flex flex-col gap-3 rounded-[8px] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <strong>{t("paymentNumber")}:</strong> {settings?.paymentPhone || SERVICE_CONFIG.paymentPhone}
                </p>
                <button type="button" onClick={copyPaymentNumber} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white">
                  <Copy className="h-4 w-4" />
                  {copied ? t("copied") : t("copyNumber")}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-[8px] border border-emerald-300 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
            {t("bookingSubmitted")}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href={trackingPath} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white">
              <ExternalLink className="h-4 w-4" />
              {language === "ar" ? "تتبع الحجز" : "Track booking"}
            </Link>
            <button type="button" onClick={copyTrackingLink} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-950 ring-1 ring-slate-200">
              <Copy className="h-4 w-4" />
              {trackingCopied ? t("copied") : language === "ar" ? "نسخ رابط التتبع" : "Copy tracking link"}
            </button>
            <button type="button" onClick={shareTrackingLink} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-sky-50 px-4 text-sm font-black text-sky-800 ring-1 ring-sky-100 sm:col-span-2">
              <Share2 className="h-4 w-4" />
              {language === "ar" ? "مشاركة رابط التتبع" : "Share tracking link"}
            </button>
          </div>
          {remainingMs !== null ? (
            <div className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center justify-between gap-3 text-sm font-black">
                <span>{remainingMs > 0 ? t("paymentCountdown") : t("bookingExpired")}</span>
                <span>{remainingMs > 0 ? formatCountdown(remainingMs) : "00:00:00"}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${paymentProgress}%` }} />
              </div>
            </div>
          ) : null}
          {!isFreeBooking ? <p className="mt-4 text-sm leading-6 text-slate-600">{t("manualPayment")}</p> : null}

          {!isFreeBooking ? (
            <>
              <div className="mt-6 grid gap-3">
                <a
                  href={`instapay://pay?phone=${settings?.paymentPhone || SERVICE_CONFIG.paymentPhone}&amount=${servicePrice}`}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-base font-black text-white"
                >
                  <WalletCards className="h-4 w-4" />
                  {t("openInstapay")}
                </a>
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-base font-black text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("sendScreenshot")}
                </a>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[8px] border border-emerald-300 bg-emerald-50 p-4 text-sm font-black leading-6 text-emerald-900">
              {t("freeBookingMessage")}
            </div>
          )}

          <Link href="/" className="mt-6 inline-flex text-sm font-black text-sky-700">
            {t("backToBooking")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ReceiptItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-[8px] bg-slate-50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-slate-950 ${strong ? "text-lg font-black" : "font-bold"}`}>{value}</p>
    </div>
  );
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, "0")).join(":");
}
