"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, WalletCards } from "lucide-react";
import { DEFAULT_SERVICE, PROMO_CODES, SERVICE_CONFIG } from "@/lib/constants";
import type { Booking } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SuccessPage() {
  const { language, dir, t } = useLanguage();
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
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking, language]);
  const appliedPromo = booking?.promoCode ? PROMO_CODES.find((promo) => promo.code === booking.promoCode) : null;
  const servicePrice = Math.max(DEFAULT_SERVICE.priceEgp - (appliedPromo?.discountEgp || 0), 0);

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
            <p>{t("successPaymentPrompt")}</p>
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
              <strong>{t("bookingDate")}:</strong> {booking?.bookingDate || "-"}
            </p>
            <p>
              <strong>{t("area")}:</strong> {booking?.areaName || booking?.area || "-"}
            </p>
            <p>
              <strong>{t("bookingStatus")}:</strong> {t("pendingPayment")}
            </p>
          </div>

          <div className="mt-6 grid gap-3 rounded-[8px] border border-sky-200 bg-sky-50 p-4 text-slate-950">
            <p>
              <strong>{t("servicePrice")}:</strong> {servicePrice} EGP
            </p>
            <p>
              <strong>{t("paymentNumber")}:</strong> {SERVICE_CONFIG.paymentPhone}
            </p>
          </div>

          <div className="mt-6 rounded-[8px] border border-emerald-300 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
            {t("bookingSubmitted")}
          </div>

          <div className="mt-6 grid gap-3">
            <a
              href={`instapay://pay?phone=${SERVICE_CONFIG.paymentPhone}&amount=${servicePrice}`}
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

          <p className="mt-4 text-sm leading-6 text-slate-600">{t("manualPayment")}</p>

          <Link href="/" className="mt-6 inline-flex text-sm font-black text-sky-700">
            {t("backToBooking")}
          </Link>
        </div>
      </div>
    </main>
  );
}
