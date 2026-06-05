"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, MessageCircle, QrCode, WalletCards } from "lucide-react";
import { DEFAULT_SERVICE, SERVICE_CONFIG } from "@/lib/constants";
import type { Booking } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SuccessPage() {
  const { language, dir, t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [booking] = useState<Booking | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("latestBooking");
    return raw ? (JSON.parse(raw) as Booking) : null;
  });

  const whatsAppUrl = useMemo(() => {
    const message =
      language === "ar"
        ? `مرحبًا، لقد قمت بتحويل رسوم حجز غسيل السيارة.\nالاسم: ${booking?.customerName || ""}\nرقم الهاتف: ${booking?.phoneNumber || ""}`
        : `Hello, I have completed the payment for my car wash booking.\nName: ${booking?.customerName || ""}\nPhone: ${booking?.phoneNumber || ""}`;
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking, language]);

  async function copyNumber() {
    await navigator.clipboard.writeText(SERVICE_CONFIG.paymentPhone);
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
          <p className="mt-3 leading-7 text-slate-700 dark:text-slate-200">{t("successCopy")}</p>

          <div className="mt-6 grid gap-3 rounded-[8px] bg-sky-50 p-4 text-sm text-slate-800">
            <p>
              <strong>{t("bookingDate")}:</strong> {booking?.bookingDate || "Latest booking"}
            </p>
            <p>
              <strong>{t("paymentStatus")}:</strong> Pending
            </p>
            <p>
              <strong>{t("servicePrice")}:</strong> {DEFAULT_SERVICE.priceEgp} EGP
            </p>
          </div>

          <div className="mt-6 rounded-[8px] border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">{t("instapayNumber")}</p>
            <p className="mt-1 text-2xl font-black">{SERVICE_CONFIG.paymentPhone}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={copyNumber} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-white px-3 text-sm font-black text-sky-800 ring-1 ring-sky-200">
                <Copy className="h-4 w-4" />
                {copied ? t("copied") : t("copyNumber")}
              </button>
              <a
                href={`instapay://pay?phone=${SERVICE_CONFIG.paymentPhone}&amount=${DEFAULT_SERVICE.priceEgp}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-3 text-sm font-black text-white"
              >
                <WalletCards className="h-4 w-4" />
                {t("openInstapay")}
              </a>
            </div>
            <div className="mt-3 flex min-h-24 items-center gap-3 rounded-[8px] border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
              <QrCode className="h-8 w-8" />
              <span>{t("qrFuture")}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
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
