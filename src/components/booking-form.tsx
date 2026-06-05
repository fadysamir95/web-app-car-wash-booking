"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, LocateFixed, MessageCircle, Sparkles, Upload } from "lucide-react";
import { SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate, getTomorrowDateValue, getUpcomingDateValues } from "@/lib/date";
import type { Booking, BookingCapacity } from "@/lib/types";

type FormState = {
  customerName: string;
  phoneNumber: string;
  carType: string;
  plateNumber: string;
  carImageName: string;
  carLocation: string;
  address: string;
  buildingNumber: string;
  area: string;
  bookingDate: string;
  notes: string;
  promoCode: string;
  consent: boolean;
};

const initialState: FormState = {
  customerName: "",
  phoneNumber: "",
  carType: "",
  plateNumber: "",
  carImageName: "",
  carLocation: "",
  address: "",
  buildingNumber: "",
  area: "",
  bookingDate: getTomorrowDateValue(),
  notes: "",
  promoCode: "",
  consent: false
};

const steps = ["Car", "Location", "Date", "Confirm"];

export function BookingForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [capacity, setCapacity] = useState<BookingCapacity | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const activeStep = useMemo(() => {
    if (!form.customerName || !form.phoneNumber || !form.carType || !form.plateNumber) return 0;
    if (!form.area || !form.address || !form.buildingNumber || !form.carLocation) return 1;
    if (!form.bookingDate) return 2;
    return 3;
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/capacity?date=${form.bookingDate}`)
      .then((response) => response.json())
      .then((data: BookingCapacity) => {
        if (!cancelled) setCapacity(data);
      })
      .catch(() => {
        if (!cancelled) setCapacity(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCapacity(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.bookingDate]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "bookingDate") {
      setLoadingCapacity(true);
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setErrors((current) => ({ ...current, carLocation: "Geolocation is not available in this browser." }));
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        update("carLocation", `https://www.google.com/maps?q=${latitude},${longitude}`);
        setLocationLoading(false);
      },
      () => {
        setErrors((current) => ({
          ...current,
          carLocation: "Location permission was not granted. Paste a Google Maps link instead."
        }));
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = (await response.json()) as { booking?: Booking; errors?: Record<string, string> };

    setSubmitting(false);
    if (!response.ok || !payload.booking) {
      setErrors(payload.errors || { form: "Something went wrong. Please try again." });
      return;
    }

    sessionStorage.setItem("latestBooking", JSON.stringify(payload.booking));
    window.location.href = `/success?id=${payload.booking.id}`;
  }

  const upcomingDates = getUpcomingDateValues(10);

  return (
    <form id="booking" onSubmit={submitBooking} className="glass-panel rounded-[8px] p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
          <Sparkles className="h-4 w-4" />
          Mobile-first booking
        </div>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Book your wash</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Service is currently available in {SERVICE_CONFIG.city}, {SERVICE_CONFIG.governorate} only.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <div key={step} className="min-w-0">
            <div
              className={`h-2 rounded-full ${index <= activeStep ? "bg-sky-500" : "bg-slate-200"}`}
              aria-hidden="true"
            />
            <p className="mt-2 truncate text-[0.72rem] font-bold text-slate-600">{step}</p>
          </div>
        ))}
      </div>

      {errors.form ? <div className="mb-4 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">{errors.form}</div> : null}

      <div className="grid gap-4">
        <Field label="Full name" error={errors.customerName}>
          <input className="field" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
        </Field>

        <Field label="Phone number" error={errors.phoneNumber}>
          <input
            className="field"
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            value={form.phoneNumber}
            onChange={(e) => update("phoneNumber", e.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Car color and model" error={errors.carType}>
            <input className="field" placeholder="White Toyota Corolla" value={form.carType} onChange={(e) => update("carType", e.target.value)} required />
          </Field>
          <Field label="Plate number" error={errors.plateNumber}>
            <input className="field" value={form.plateNumber} onChange={(e) => update("plateNumber", e.target.value)} required />
          </Field>
        </div>

        <Field label="Car photo (optional)" error={errors.carImageName}>
          <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm font-bold text-sky-800">
            <Upload className="h-4 w-4" />
            <span className="truncate">{form.carImageName || "Choose photo name"}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(e) => update("carImageName", e.target.files?.[0]?.name || "")}
            />
          </label>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Governorate">
            <input className="field" value={SERVICE_CONFIG.governorate} disabled />
          </Field>
          <Field label="City">
            <input className="field" value={SERVICE_CONFIG.city} disabled />
          </Field>
        </div>

        <Field label="Area" error={errors.area}>
          <select className="field" value={form.area} onChange={(e) => update("area", e.target.value)} required>
            <option value="">Choose supported area</option>
            {SERVICE_CONFIG.areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
          <Field label="Detailed address" error={errors.address}>
            <input className="field" value={form.address} onChange={(e) => update("address", e.target.value)} required />
          </Field>
          <Field label="Building no." error={errors.buildingNumber}>
            <input className="field" value={form.buildingNumber} onChange={(e) => update("buildingNumber", e.target.value)} required />
          </Field>
        </div>

        <Field label="Car location" error={errors.carLocation}>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locationLoading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Use GPS
            </button>
            <input
              className="field"
              placeholder="Or paste Google Maps link"
              value={form.carLocation}
              onChange={(e) => update("carLocation", e.target.value)}
              required
            />
          </div>
        </Field>

        <Field label={`Wash date (${SERVICE_CONFIG.bookingWindow})`} error={errors.bookingDate}>
          <div className="grid gap-3">
            <input
              className="field"
              type="date"
              min={getTomorrowDateValue()}
              value={form.bookingDate}
              onChange={(e) => update("bookingDate", e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {upcomingDates.map((date) => {
                const selected = date === form.bookingDate;
                const full = selected && capacity?.fullyBooked;
                return (
                  <button
                    type="button"
                    key={date}
                    disabled={full}
                    onClick={() => update("bookingDate", date)}
                    className={`min-h-20 rounded-[8px] border p-2 text-left text-xs transition ${
                      selected ? "border-sky-500 bg-sky-50 text-sky-950" : "border-slate-200 bg-white text-slate-700"
                    } ${full ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span className="block font-black">{formatDisplayDate(date)}</span>
                    <span className="mt-1 block text-[0.68rem]">{SERVICE_CONFIG.bookingWindow}</span>
                    {selected ? (
                      <span className="mt-1 block font-bold">
                        {loadingCapacity ? "Checking..." : capacity?.fullyBooked ? "Fully booked" : `${capacity?.remaining ?? "-"} left`}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Promo code (optional)" error={errors.promoCode}>
            <input className="field" value={form.promoCode} onChange={(e) => update("promoCode", e.target.value)} />
          </Field>
          <Field label="Extra notes (optional)" error={errors.notes}>
            <input className="field" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-[8px] bg-white/80 p-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-sky-600"
            checked={form.consent}
            onChange={(e) => update("consent", e.target.checked)}
            required
          />
          <span>I agree to use my data for booking communication and future offers.</span>
        </label>
        {errors.consent ? <p className="error-text">{errors.consent}</p> : null}

        <div className="rounded-[8px] border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-sky-950">
            <CalendarDays className="h-4 w-4" />
            Payment confirmation
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Price is <strong>{SERVICE_CONFIG.priceEgp} EGP</strong>. Your booking stays pending until transfer is received on{" "}
            <strong>{SERVICE_CONFIG.paymentPhone}</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`instapay://pay?phone=${SERVICE_CONFIG.paymentPhone}&amount=${SERVICE_CONFIG.priceEgp}`}
              className="inline-flex items-center gap-2 rounded-[8px] bg-white px-3 py-2 text-sm font-black text-sky-800 ring-1 ring-sky-200"
            >
              <Check className="h-4 w-4" />
              Try Instapay
            </a>
            <a
              href={`https://wa.me/2${SERVICE_CONFIG.paymentPhone}?text=${encodeURIComponent(
                `Hello, I sent the transfer to confirm my car wash booking. Name: ${form.customerName} - Phone: ${form.phoneNumber}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[8px] bg-emerald-500 px-3 py-2 text-sm font-black text-white"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp proof
            </a>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || capacity?.fullyBooked}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-5 text-base font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          Book your car wash
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
}
