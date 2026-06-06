"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, MessageCircle, WalletCards } from "lucide-react";
import { PROMO_CODES, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import { finalPriceFromPromo } from "@/lib/pricing";
import type { Booking, ServiceSettings } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SuccessPage() {
  const { language, dir, t } = useLanguage();
  const [copied, setCopied] = useState(false);
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

  return (
    <main className="min-h-svh bg-slate-950 px-4 py-8 text-white" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-black text-white">
            {t("brand")}
          </Link>
          <LanguageSwitcher />
        </header>

        <div className="glass-panel rounded-[8px] p-6 text-slate-950 sm:p-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-3xl font-black">{t("successTitle")}</h1>

          <div className="mt-3 space-y-2 leading-7 text-slate-700 dark:text-slate-200">
            <p>{t("successCopy")}</p>
            <p>{t("successReserved")}</p>
            <p>{isFreeBooking ? t("freeBookingMessage") : t("successPaymentPrompt")}</p>
          </div>

          <div className="mt-6 grid gap-3 rounded-[8px] bg-sky-50 p-4 text-sm text-slate-800">
            <p>
              <strong>{t("bookingReference")}:</strong> {booking?.id || "-"}
            </p>
            <p>
              <strong>{t("fullName")}:</strong> {booking?.customerName || "-"}
            </p>
            <p>
              <strong>{t("phoneNumber")}:</strong> {booking?.phoneNumber || "-"}
            </p>
            <p>
              <strong>{t("bookingDate")}:</strong> {booking ? formatDisplayDate(booking.bookingDate, language) : "-"}
            </p>
            <p>
              <strong>{t("area")}:</strong> {booking?.areaName || booking?.area || "-"}
            </p>
            <p>
              <strong>{t("bookingStatus")}:</strong> {isFreeBooking ? t("bookingConfirmed") : t("pendingPayment")}
            </p>
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
          {remainingMs !== null ? (
            <div className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950">
              {remainingMs > 0 ? `${t("paymentCountdown")}: ${formatCountdown(remainingMs)}` : t("bookingExpired")}
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

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, "0")).join(":");
}
