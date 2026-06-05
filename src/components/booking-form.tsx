"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  LocateFixed,
  Upload
} from "lucide-react";
import { DEFAULT_CITY, DEFAULT_GOVERNORATE, DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate, getTomorrowDateValue, getUpcomingDateValues } from "@/lib/date";
import type { Booking, BookingCapacity, PromoCode } from "@/lib/types";
import { useLanguage } from "./language-provider";

type FormState = {
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  plateLetters: string;
  plateDigits: string;
  carImageName: string;
  area: string;
  address: string;
  buildingNumber: string;
  carLocation: string;
  bookingDate: string;
  notes: string;
  promoCode: string;
  consent: boolean;
  washWindowAcknowledged: boolean;
  website: string;
};

const initialState: FormState = {
  customerName: "",
  phoneNumber: "",
  carBrand: "",
  carModel: "",
  carColor: "",
  plateLetters: "",
  plateDigits: "",
  carImageName: "",
  area: "",
  address: "",
  buildingNumber: "",
  carLocation: "",
  bookingDate: getTomorrowDateValue(),
  notes: "",
  promoCode: "",
  consent: false,
  washWindowAcknowledged: false,
  website: ""
};

export function BookingForm() {
  const { language, dir, t } = useLanguage();
  const [form, setForm] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [capacity, setCapacity] = useState<BookingCapacity | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(PROMO_CODES.map((promo) => ({ ...promo, active: true })));

  const steps = [
    t("customerInfo"),
    t("carInfo"),
    t("bookingDate")
  ];

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/promos")
      .then((response) => response.json())
      .then((payload: { promos: PromoCode[] }) => {
        if (!cancelled) setPromoCodes(payload.promos || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingDates = useMemo(() => getUpcomingDateValues(10), []);
  const appliedPromo = promoCodes.find((promo) => promo.code === form.promoCode.trim().toLowerCase());
  const promoDiscount = appliedPromo ? appliedPromo.discountEgp : 0;
  const finalPrice = Math.max(DEFAULT_SERVICE.priceEgp - promoDiscount, 0);
  const plateNumber = [form.plateLetters.trim(), form.plateDigits.trim()].filter(Boolean).join(" - ");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "bookingDate") setLoadingCapacity(true);
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "plateLetters" || key === "plateDigits") delete next.plateNumber;
      if (key === "address" || key === "carLocation") delete next.location;
      return next;
    });
  }

  function focusFirstError(nextErrors: Record<string, string>, targetStep: number) {
    const fieldOrder = targetStep === 0
      ? ["customerName", "phoneNumber", "area", "address", "carLocation"]
      : targetStep === 1
        ? ["carBrand", "carModel", "carColor", "consent"]
        : ["bookingDate", "promoCode", "washWindowAcknowledged"];
    const firstKey = fieldOrder.find((key) => nextErrors[key] || (key === "address" && nextErrors.location));

    window.setTimeout(() => {
      const target = firstKey ? document.querySelector<HTMLElement>(`[name="${firstKey}"]`) : document.querySelector<HTMLElement>(".error-text");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 80);
  }

  function validateStep(targetStep = step) {
    const nextErrors: Record<string, string> = {};
    if (targetStep === 0) {
      if (form.customerName.trim().length < 3) nextErrors.customerName = t("requiredName");
      if (!/^(?:\+20|0020|0)?1[0125]\d{8}$/.test(form.phoneNumber.trim())) nextErrors.phoneNumber = t("requiredPhone");
      if (!form.area) nextErrors.area = t("requiredArea");
      if (form.address.trim().length < 6 && form.carLocation.trim().length < 5) nextErrors.location = t("requiredLocation");
    }
    if (targetStep === 1) {
      if (form.carBrand.trim().length < 2) nextErrors.carBrand = t("requiredBrand");
      if (!form.carModel.trim()) nextErrors.carModel = t("requiredModel");
      if (form.carColor.trim().length < 2) nextErrors.carColor = t("requiredColor");
      if (!form.consent) nextErrors.consent = t("requiredConsent");
    }
    if (targetStep === 2) {
      if (!form.bookingDate) nextErrors.bookingDate = t("requiredDate");
      if (form.promoCode.trim() && !promoCodes.some((promo) => promo.code === form.promoCode.trim().toLowerCase())) nextErrors.promoCode = t("invalidPromo");
      if (!form.washWindowAcknowledged) nextErrors.washWindowAcknowledged = t("requiredAck");
    }
    setErrors(nextErrors);
    const isValid = Object.keys(nextErrors).length === 0;
    if (!isValid) focusFirstError(nextErrors, targetStep);
    return isValid;
  }

  function goNext() {
    if (validateStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setErrors((current) => ({ ...current, carLocation: t("gpsUnavailable") }));
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
        setErrors((current) => ({ ...current, carLocation: t("gpsDenied") }));
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function validateAllSteps() {
    const checks = [0, 1, 2];
    for (const item of checks) {
      if (!validateStep(item)) {
        setStep(item);
        return false;
      }
    }
    return true;
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAllSteps()) return;
    setSubmitting(true);
    setErrors({});

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, plateNumber, sourceLanguage: language })
    });
    const payload = (await response.json()) as { booking?: Booking; errors?: Record<string, string> };

    setSubmitting(false);
    if (!response.ok || !payload.booking) {
      setErrors(payload.errors || { form: t("genericError") });
      const serverErrors = payload.errors || {};
      if (serverErrors.customerName || serverErrors.phoneNumber || serverErrors.area || serverErrors.location) setStep(0);
      else if (serverErrors.carBrand || serverErrors.carModel || serverErrors.carColor || serverErrors.consent) setStep(1);
      else setStep(2);
      focusFirstError(serverErrors, serverErrors.customerName || serverErrors.phoneNumber || serverErrors.area || serverErrors.location ? 0 : serverErrors.carBrand || serverErrors.carModel || serverErrors.carColor || serverErrors.consent ? 1 : 2);
      return;
    }

    sessionStorage.setItem("latestBooking", JSON.stringify(payload.booking));
    window.location.href = `/success?id=${payload.booking.id}`;
  }

  return (
    <form id="booking" onSubmit={submitBooking} className="glass-panel rounded-[8px] p-4 sm:p-6" dir={dir}>
      <div className="mb-6">
        <div className="text-sm font-bold text-sky-700">{t("mobileFirst")}</div>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{t("bookWash")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t("serviceScope")}</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {steps.map((item, index) => (
          <button key={item} type="button" onClick={() => setStep(index)} className="min-w-0 text-start">
            <div className={`h-2 rounded-full ${index <= step ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`} />
            <p className="mt-2 truncate text-[0.68rem] font-bold text-slate-600 dark:text-slate-300">{item}</p>
          </button>
        ))}
      </div>

      {errors.form ? <Alert>{errors.form}</Alert> : null}

      <div className="grid gap-4">
        {step === 0 ? (
          <>
            <Field label={t("fullName")} error={errors.customerName}>
              <input name="customerName" className={fieldClass(errors.customerName)} value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
            </Field>
            <Field label={t("phoneNumber")} error={errors.phoneNumber}>
              <input
                name="phoneNumber"
                className={fieldClass(errors.phoneNumber)}
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                value={form.phoneNumber}
                onChange={(e) => update("phoneNumber", e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("governorate")}>
                <input className="field" value={DEFAULT_GOVERNORATE.name[language]} disabled />
              </Field>
              <Field label={t("city")}>
                <input className="field" value={DEFAULT_CITY.name[language]} disabled />
              </Field>
            </div>
            <Field label={t("area")} error={errors.area}>
              <select name="area" className={fieldClass(errors.area)} value={form.area} onChange={(e) => update("area", e.target.value)} required>
                <option value="">{t("chooseArea")}</option>
                {SERVICE_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name[language]}
                  </option>
                ))}
              </select>
            </Field>
            <Alert>{t("locationHelp")}</Alert>
            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
              <Field label={t("detailedAddress")} error={errors.location}>
                <input name="address" className={fieldClass(errors.location)} value={form.address} onChange={(e) => update("address", e.target.value)} />
              </Field>
              <Field label={t("buildingNumber")}>
                <input className="field" value={form.buildingNumber} onChange={(e) => update("buildingNumber", e.target.value)} />
              </Field>
            </div>
            <Field label={t("carLocation")} error={errors.carLocation}>
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locationLoading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                >
                  {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  {t("useGps")}
                </button>
                <input name="carLocation" className={fieldClass(errors.carLocation || errors.location)} placeholder={t("mapsPlaceholder")} value={form.carLocation} onChange={(e) => update("carLocation", e.target.value)} />
              </div>
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label={t("carBrand")} error={errors.carBrand}>
              <input name="carBrand" className={fieldClass(errors.carBrand)} list="car-brands" value={form.carBrand} onChange={(e) => update("carBrand", e.target.value)} required />
              <datalist id="car-brands">
                {SERVICE_CONFIG.carBrands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("carModel")} error={errors.carModel}>
                <input name="carModel" className={fieldClass(errors.carModel)} value={form.carModel} onChange={(e) => update("carModel", e.target.value)} required />
              </Field>
              <Field label={t("carColor")} error={errors.carColor}>
                <input name="carColor" className={fieldClass(errors.carColor)} value={form.carColor} onChange={(e) => update("carColor", e.target.value)} required />
              </Field>
            </div>
            <Field label={t("plateNumber")} error={errors.plateNumber}>
              <div className="grid grid-cols-[1fr_1.25fr] gap-3 rounded-[8px] border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <label>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">{t("plateLetters")}</span>
                  <input
                    className="field text-center text-lg font-black"
                    value={form.plateLetters}
                    onChange={(e) => update("plateLetters", normalizePlateLetters(e.target.value))}
                    placeholder={language === "ar" ? "أ ب ج" : "A B C"}
                    dir="auto"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">{t("plateDigits")}</span>
                  <input
                    className="field text-center text-lg font-black"
                    inputMode="numeric"
                    value={form.plateDigits}
                    onChange={(e) => update("plateDigits", e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="1234"
                  />
                </label>
              </div>
            </Field>
            <Field label={t("carPhoto")} error={errors.carImageName}>
              <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                <Upload className="h-4 w-4" />
                <span className="truncate">{form.carImageName || t("choosePhoto")}</span>
                <input className="sr-only" type="file" accept="image/*" onChange={(e) => update("carImageName", e.target.files?.[0]?.name || "")} />
              </label>
            </Field>
            <Field label={t("notes")} error={errors.notes}>
              <textarea className="field min-h-28 resize-y" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </Field>
            <label className="flex items-start gap-3 rounded-[8px] bg-white/80 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
              <input name="consent" type="checkbox" className={`mt-1 h-4 w-4 accent-sky-600 ${errors.consent ? "ring-2 ring-rose-400" : ""}`} checked={form.consent} onChange={(e) => update("consent", e.target.checked)} />
              <span>{t("consent")}</span>
            </label>
            {errors.consent ? <p className="error-text">{errors.consent}</p> : null}
              <input name="website" className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label={`${t("bookingDate")} (${language === "ar" ? DEFAULT_SERVICE.bookingWindowAr : DEFAULT_SERVICE.bookingWindow})`} error={errors.bookingDate}>
              <input name="bookingDate" className={fieldClass(errors.bookingDate)} type="date" min={getTomorrowDateValue()} value={form.bookingDate} onChange={(e) => update("bookingDate", e.target.value)} required />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {upcomingDates.map((date) => {
                  const selected = date === form.bookingDate;
                  const full = selected && capacity?.fullyBooked;
                  return (
                    <button
                      type="button"
                      key={date}
                      disabled={full}
                      onClick={() => update("bookingDate", date)}
                      className={`min-h-20 rounded-[8px] border p-2 text-start text-xs transition ${
                        selected ? "border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      } ${full ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="block font-black">{formatDisplayDate(date, language)}</span>
                      <span className="mt-1 block text-[0.68rem]">{language === "ar" ? DEFAULT_SERVICE.bookingWindowAr : DEFAULT_SERVICE.bookingWindow}</span>
                      {selected ? (
                        <span className="mt-1 block font-bold">
                          {loadingCapacity ? t("checking") : capacity?.fullyBooked ? t("fullyBooked") : `${capacity?.remaining ?? "-"} ${t("left")}`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("promoCode")} error={errors.promoCode}>
              <input name="promoCode" className={fieldClass(errors.promoCode)} value={form.promoCode} onChange={(e) => update("promoCode", e.target.value)} />
            </Field>
            <div className="rounded-[8px] border border-sky-200 bg-sky-50 p-4 text-slate-950 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t("servicePrice")}</span>
                <span className="font-black">{DEFAULT_SERVICE.priceEgp} EGP</span>
              </div>
              {appliedPromo ? (
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{t("promoDiscount")}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-300">-{promoDiscount} EGP</span>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-sky-200 pt-3 dark:border-sky-900">
                <span className="text-sm font-black">{t("finalPrice")}</span>
                <span className="text-2xl font-black text-sky-700 dark:text-sky-200">{finalPrice} EGP</span>
              </div>
            </div>
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
              <p className="font-black">{t("importantNoticeTitle")}</p>
              <p className="mt-2 whitespace-pre-line">{t("preSubmitNotice")}</p>
            </div>
            <label className="flex items-start gap-3 rounded-[8px] bg-white/80 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
              <input name="washWindowAcknowledged" type="checkbox" className={`mt-1 h-4 w-4 accent-sky-600 ${errors.washWindowAcknowledged ? "ring-2 ring-rose-400" : ""}`} checked={form.washWindowAcknowledged} onChange={(e) => update("washWindowAcknowledged", e.target.checked)} />
              <span>{t("acknowledgeWindow")}</span>
            </label>
            {errors.washWindowAcknowledged ? <p className="error-text">{errors.washWindowAcknowledged}</p> : null}
          </>
        ) : null}

        <div className="mt-2 flex gap-3">
          {step > 0 ? (
            <button type="button" onClick={goBack} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[8px] bg-slate-200 px-4 text-sm font-black text-slate-950 dark:bg-slate-800 dark:text-white">
              {dir === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {t("back")}
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button type="button" onClick={goNext} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              {t("next")}
              {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          ) : (
            <button type="submit" disabled={submitting || capacity?.fullyBooked} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {t("submit")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] bg-sky-50 p-3 text-sm leading-6 text-sky-900 dark:bg-sky-950/45 dark:text-sky-100">
      {children}
    </div>
  );
}

function fieldClass(error?: string) {
  return `field ${error ? "field-error" : ""}`;
}

function normalizePlateLetters(value: string) {
  return value
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 4)
    .split("")
    .join(" ");
}
