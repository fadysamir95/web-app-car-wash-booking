"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, WalletCards } from "lucide-react";
import { SERVICE_CONFIG } from "@/lib/constants";
import type { Booking } from "@/lib/types";

export default function SuccessPage() {
  const [booking] = useState<Booking | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("latestBooking");
    return raw ? (JSON.parse(raw) as Booking) : null;
  });

  const whatsAppUrl = useMemo(() => {
    const message = `Hello, I sent the transfer to confirm my car wash booking. Name: ${
      booking?.customerName || ""
    } - Phone: ${booking?.phoneNumber || ""}`;
    return `https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(message)}`;
  }, [booking]);

  return (
    <main className="min-h-svh bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[8px] p-6 text-slate-950 sm:p-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-3xl font-black">Booking received</h1>
          <p className="mt-3 leading-7 text-slate-700">
            Your booking is saved as pending. It will be confirmed after transferring{" "}
            <strong>{SERVICE_CONFIG.priceEgp} EGP</strong> to <strong>{SERVICE_CONFIG.paymentPhone}</strong>.
          </p>

          <div className="mt-6 grid gap-3 rounded-[8px] bg-sky-50 p-4 text-sm text-slate-800">
            <p>
              <strong>Booking window:</strong> {SERVICE_CONFIG.bookingWindow}
            </p>
            <p>
              <strong>Date:</strong> {booking?.bookingDate || "Latest booking"}
            </p>
            <p>
              <strong>Status:</strong> Payment Pending / Booking Pending
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={`instapay://pay?phone=${SERVICE_CONFIG.paymentPhone}&amount=${SERVICE_CONFIG.priceEgp}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white"
            >
              <WalletCards className="h-4 w-4" />
              Open Instapay
            </a>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Send transfer proof
            </a>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            If the Instapay button does not open, transfer manually to {SERVICE_CONFIG.paymentPhone}, then send the receipt on WhatsApp.
          </p>

          <Link href="/" className="mt-6 inline-flex text-sm font-black text-sky-700">
            Back to booking
          </Link>
        </div>
      </div>
    </main>
  );
}
