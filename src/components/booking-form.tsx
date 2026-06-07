"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  LocateFixed,
  Trash2,
  Upload
} from "lucide-react";
import { DEFAULT_CITY, DEFAULT_GOVERNORATE, DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate, getTomorrowDateValue, getUpcomingDateValues, isBookingDateAllowed } from "@/lib/date";
import { finalPriceFromPromo, promoDiscountAmount, promoDisplayValue } from "@/lib/pricing";
import type { Booking, BookingCapacity, PromoCode, ServiceSettings } from "@/lib/types";
import { BurnoutLoader } from "./burnout-loader";
import { useLanguage } from "./language-provider";

type FormState = {
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  carYear: string;
  plateLetters: string;
  plateDigits: string;
  carImageName: string;
  carImageDataUrl: string;
  area: string;
  address: string;
  buildingNumber: string;
  carLocation: string;
  bookingDate: string;
  notes: string;
  promoCode: string;
  loyaltyRewardRedeemed: boolean;
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
  carYear: "",
  plateLetters: "",
  plateDigits: "",
  carImageName: "",
  carImageDataUrl: "",
  area: "",
  address: "",
  buildingNumber: "",
  carLocation: "",
  bookingDate: "",
  notes: "",
  promoCode: "",
  loyaltyRewardRedeemed: false,
  consent: true,
  washWindowAcknowledged: true,
  website: ""
};

export function BookingForm() {
  const { language, dir, t } = useLanguage();
  const [form, setForm] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [capacity, setCapacity] = useState<BookingCapacity | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })));
  const [settings, setSettings] = useState<ServiceSettings>({
    servicePriceEgp: DEFAULT_SERVICE.priceEgp,
    paymentPhone: SERVICE_CONFIG.paymentPhone,
    maxBookingsPerDay: SERVICE_CONFIG.maxBookingsPerDay,
    washWindow: DEFAULT_SERVICE.bookingWindow,
    washWindowAr: DEFAULT_SERVICE.bookingWindowAr,
    areas: SERVICE_AREAS.map((area) => ({ id: area.id, nameEn: area.name.en, nameAr: area.name.ar, priceEgp: area.priceEgp, active: true }))
  });
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState("");
  const [promoChecked, setPromoChecked] = useState(false);
  const [returningBookings, setReturningBookings] = useState<Booking[]>([]);
  const [returningLookupDone, setReturningLookupDone] = useState(false);
  const [selectedPreviousCarKey, setSelectedPreviousCarKey] = useState("");
  const [bookingClock, setBookingClock] = useState(0);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const confirmSubmitRef = useRef<HTMLDivElement>(null);

  const steps = [
    t("customerInfo"),
    t("locationInfo"),
    t("carInfo"),
    t("bookingDate")
  ];

  useEffect(() => {
    if (!form.bookingDate) return;
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

  useEffect(() => {
    const firstTick = window.setTimeout(() => setBookingClock(Date.now()), 0);
    const timer = window.setInterval(() => setBookingClock(Date.now()), 60_000);
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
        if (!cancelled && payload.settings) setSettings(payload.settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("rebookDraft");
    if (!raw) return;
    window.localStorage.removeItem("rebookDraft");
    try {
      const draft = JSON.parse(raw) as Partial<FormState>;
      const timer = window.setTimeout(() => {
        setForm((current) => ({ ...current, ...draft, bookingDate: "", promoCode: "", loyaltyRewardRedeemed: false }));
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // Ignore invalid local drafts.
    }
  }, []);

  const bookingNow = useMemo(() => new Date(bookingClock), [bookingClock]);
  const earliestBookingDate = getTomorrowDateValue(bookingNow);
  const upcomingDates = useMemo(() => getUpcomingDateValues(10, bookingNow), [bookingNow]);
  const activeAreas = settings.areas.filter((area) => area.active);
  const selectedArea = activeAreas.find((area) => area.id === form.area);
  const basePrice = selectedArea?.priceEgp ?? settings.servicePriceEgp;
  const appliedPromo = promoCodes.find((promo) => promo.code === form.promoCode.trim().toLowerCase());
  const promoDiscount = promoDiscountAmount(appliedPromo, basePrice);
  const priceAfterPromo = finalPriceFromPromo(appliedPromo, basePrice);
  const plateNumber = [form.plateLetters.trim(), form.plateDigits.trim()].filter(Boolean).join(" - ");
  const washWindow = language === "ar" ? settings.washWindowAr : settings.washWindow;
  const lastBooking = returningBookings[0] || null;
  const previousArea = lastBooking ? activeAreas.find((area) => area.id === lastBooking.area) : null;
  const previousAreaPrice = previousArea?.priceEgp ?? lastBooking?.finalPriceEgp;
  const showAreaPriceWarning = Boolean(selectedArea && previousAreaPrice !== undefined && selectedArea.priceEgp !== previousAreaPrice);
  const previousCars = uniquePreviousCars(returningBookings);
  const loyaltyBalance = returningBookings.reduce((total, booking) => {
    const earned = booking.bookingStatus === "Completed" ? booking.loyaltyPointsEarned && booking.loyaltyPointsEarned > 0 ? booking.loyaltyPointsEarned : 10 : 0;
    const redeemed = booking.loyaltyRewardRedeemed ? 100 : 0;
    return total + earned - redeemed;
  }, 0);
  const canRedeemLoyalty = loyaltyBalance >= 100;
  const finalPrice = form.loyaltyRewardRedeemed && canRedeemLoyalty ? 0 : priceAfterPromo;
  const bookingClosedByCutoff = Boolean(form.bookingDate && !isBookingDateAllowed(form.bookingDate, bookingNow));
  const bookingClosed = bookingClosedByCutoff || Boolean(capacity?.fullyBooked);
  const bookingCloseNotice =
    language === "ar"
      ? "آخر موعد للحجز هو قبل بداية موعد غسل السيارات الساعة 12:00 صباحًا. بعد دخول يوم الغسيل لا يمكن حجز نفس الفجر."
      : "The latest booking time is before the wash window starts at 12:00 AM. Once the wash day begins, that dawn can no longer be booked.";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "phoneNumber") {
      setOtpCode("");
      setOtpToken("");
      setOtpSent(false);
      setOtpDevCode("");
      setReturningBookings([]);
      setReturningLookupDone(false);
    }
    if (key === "bookingDate") {
      setLoadingCapacity(Boolean(value));
      if (!value) setCapacity(null);
    }
    if (key === "promoCode") setPromoChecked(false);
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "plateLetters" || key === "plateDigits") delete next.plateNumber;
      if (key === "buildingNumber") delete next.buildingNumber;
      return next;
    });
  }

  function focusFirstError(nextErrors: Record<string, string>, targetStep: number) {
    const fieldOrder = targetStep === 0
      ? ["customerName", "phoneNumber", "otpCode", "consent"]
      : targetStep === 1
        ? ["area", "buildingNumber", "address", "carLocation"]
        : targetStep === 2
          ? ["carBrand", "carModel", "carYear", "carColor"]
          : ["bookingDate", "promoCode", "washWindowAcknowledged"];
    const firstKey = fieldOrder.find((key) => nextErrors[key]);

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
      if (!otpToken) nextErrors.otp = t("requiredOtp");
      if (!form.consent) nextErrors.consent = t("requiredConsent");
    }
    if (targetStep === 1) {
      if (!form.area) nextErrors.area = t("requiredArea");
      if (!form.buildingNumber.trim()) nextErrors.buildingNumber = language === "ar" ? "اكتب رقم العمارة." : "Enter the building number.";
    }
    if (targetStep === 2) {
      if (form.carBrand.trim().length < 2) nextErrors.carBrand = t("requiredBrand");
      if (!form.carModel.trim()) nextErrors.carModel = t("requiredModel");
      if (!/^(19[8-9]\d|20[0-2]\d)$/.test(form.carYear.trim())) nextErrors.carYear = language === "ar" ? "اكتب سنة صنع صحيحة." : "Enter a valid manufacture year.";
      if (form.carColor.trim().length < 2) nextErrors.carColor = t("requiredColor");
    }
    if (targetStep === 3) {
      if (!form.bookingDate) nextErrors.bookingDate = t("requiredDate");
      else if (!isBookingDateAllowed(form.bookingDate, bookingNow)) nextErrors.bookingDate = language === "ar" ? "تم إغلاق الحجز لهذا التاريخ مع بداية يوم الغسيل الساعة 12:00 صباحًا." : "Booking is closed for this date because the wash day has started at 12:00 AM.";
      if (form.promoCode.trim() && !promoCodes.some((promo) => promo.code === form.promoCode.trim().toLowerCase())) nextErrors.promoCode = t("invalidPromo");
      if (!form.washWindowAcknowledged) nextErrors.washWindowAcknowledged = t("requiredAck");
    }
    setErrors(nextErrors);
    const isValid = Object.keys(nextErrors).length === 0;
    if (!isValid) focusFirstError(nextErrors, targetStep);
    return isValid;
  }

  function goNext() {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    scrollBookingTop();
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function goToStep(targetStep: number) {
    if (targetStep <= step) {
      setStep(targetStep);
      return;
    }

    for (let item = 0; item < targetStep; item += 1) {
      if (!validateStep(item)) {
        setStep(item);
        return;
      }
    }

    setStep(targetStep);
    scrollBookingTop();
  }

  function scrollBookingTop() {
    window.setTimeout(() => {
      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  async function sendOtp() {
    if (!/^(?:\+20|0020|0)?1[0125]\d{8}$/.test(form.phoneNumber.trim())) {
      setErrors((current) => ({ ...current, phoneNumber: t("requiredPhone") }));
      return;
    }

    setOtpSending(true);
    setErrors((current) => {
      const next = { ...current };
      delete next.otp;
      return next;
    });

    const response = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: form.phoneNumber })
    });
    const payload = (await response.json().catch(() => ({}))) as { devCode?: string; error?: string };
    setOtpSending(false);

    if (!response.ok) {
      setErrors((current) => ({ ...current, otp: otpApiErrorMessage(payload.error, t) }));
      return;
    }

    setOtpSent(true);
    setOtpDevCode(payload.devCode || "");
  }

  async function verifyOtpCode() {
    setOtpVerifying(true);
    const response = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: form.phoneNumber, code: otpCode })
    });
    const payload = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    setOtpVerifying(false);

    if (!response.ok || !payload.token) {
      setOtpToken("");
      setErrors((current) => ({ ...current, otp: otpApiErrorMessage(payload.error, t, "invalidOtp") }));
      return;
    }

    setOtpToken(payload.token);
    await lookupReturningBooking(payload.token);
    setErrors((current) => {
      const next = { ...current };
      delete next.otp;
      return next;
    });
  }

  async function lookupReturningBooking(tokenOverride = otpToken) {
    setReturningLookupDone(false);
    try {
      const [bookingsResponse, hiddenCarsResponse] = await Promise.all([
        fetch(`/api/bookings?query=${encodeURIComponent(form.phoneNumber.trim())}`, { cache: "no-store" }),
        tokenOverride
          ? fetch(`/api/customer/cars?phoneNumber=${encodeURIComponent(form.phoneNumber.trim())}&otpToken=${encodeURIComponent(tokenOverride)}`, { cache: "no-store" })
          : Promise.resolve(null)
      ]);
      const payload = (await bookingsResponse.json().catch(() => ({}))) as { bookings?: Booking[] };
      const hiddenPayload = hiddenCarsResponse ? ((await hiddenCarsResponse.json().catch(() => ({}))) as { hiddenCarKeys?: string[] }) : {};
      const hiddenCarKeys = new Set(hiddenPayload.hiddenCarKeys || []);
      setReturningBookings((payload.bookings || []).filter((booking) => !hiddenCarKeys.has(previousCarKey(booking))));
    } finally {
      setReturningLookupDone(true);
    }
  }

  async function removeSavedCar(booking: Booking) {
    const carLabel = `${booking.carBrand} ${booking.carModel}${booking.plateNumber ? ` - ${booking.plateNumber}` : ""}`;
    const confirmed = window.confirm(language === "ar" ? `هل تريد حذف ${carLabel} من السيارات المحفوظة؟` : `Remove ${carLabel} from saved cars?`);
    if (!confirmed) return;

    const carKey = previousCarKey(booking);
    const response = await fetch("/api/customer/cars", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: form.phoneNumber, otpToken, carKey })
    });
    if (!response.ok) return;
    setReturningBookings((current) => current.filter((item) => previousCarKey(item) !== carKey));
    if (selectedPreviousCarKey === carKey) setSelectedPreviousCarKey("");
  }

  function applyReturningBooking(booking = lastBooking) {
    if (!booking) return;
    const { plateLetters, plateDigits } = splitPlateNumber(booking.plateNumber);
    setSelectedPreviousCarKey(previousCarKey(booking));
    setForm((current) => ({
      ...current,
      customerName: booking.customerName || current.customerName,
      carBrand: booking.carBrand || current.carBrand,
      carModel: booking.carModel || current.carModel,
      carColor: booking.carColor || current.carColor,
      carYear: booking.carYear || current.carYear,
      plateLetters,
      plateDigits,
      carImageName: booking.carImageName || current.carImageName,
      carImageDataUrl: booking.carImageDataUrl || current.carImageDataUrl,
      area: booking.area || current.area,
      address: booking.address || current.address,
      buildingNumber: booking.buildingNumber || current.buildingNumber,
      carLocation: booking.carLocation || current.carLocation,
      notes: current.notes
    }));
    setErrors((current) => {
      const next = { ...current };
      ["area", "buildingNumber", "carBrand", "carModel", "carYear", "carColor", "plateNumber"].forEach((key) => delete next[key]);
      return next;
    });
  }

  function verifyPromoCode() {
    const code = form.promoCode.trim().toLowerCase();
    if (!code) {
      setErrors((current) => {
        const next = { ...current };
        delete next.promoCode;
        return next;
      });
      setPromoChecked(false);
      return;
    }
    if (!promoCodes.some((promo) => promo.code === code)) {
      setPromoChecked(false);
      setErrors((current) => ({ ...current, promoCode: t("invalidPromo") }));
      return;
    }
    setPromoChecked(true);
    setErrors((current) => {
      const next = { ...current };
      delete next.promoCode;
      return next;
    });
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
    const checks = [0, 1, 2, 3];
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
    setConfirmSubmitOpen(true);
  }

  useEffect(() => {
    if (!confirmSubmitOpen) return;
    window.setTimeout(() => {
      const top = (confirmSubmitRef.current?.getBoundingClientRect().top || 0) + window.scrollY - 24;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }, 50);
  }, [confirmSubmitOpen]);

  async function submitConfirmedBooking() {
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    setErrors({});

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, plateNumber, sourceLanguage: language, otpToken })
    });
    const payload = (await response.json()) as { booking?: Booking; errors?: Record<string, string> };

    setSubmitting(false);
    if (!response.ok || !payload.booking) {
      const serverErrors = translateServerErrors(payload.errors || {}, t);
      setErrors(Object.keys(serverErrors).length > 0 ? serverErrors : { form: t("genericError") });
      if (serverErrors.customerName || serverErrors.phoneNumber || serverErrors.otp || serverErrors.consent) setStep(0);
      else if (serverErrors.area || serverErrors.buildingNumber || serverErrors.address || serverErrors.carLocation) setStep(1);
      else if (serverErrors.carBrand || serverErrors.carModel || serverErrors.carYear || serverErrors.carColor) setStep(2);
      else setStep(3);
      focusFirstError(serverErrors, serverErrors.customerName || serverErrors.phoneNumber || serverErrors.otp || serverErrors.consent ? 0 : serverErrors.area || serverErrors.buildingNumber || serverErrors.address || serverErrors.carLocation ? 1 : serverErrors.carBrand || serverErrors.carModel || serverErrors.carYear || serverErrors.carColor ? 2 : 3);
      return;
    }

    sessionStorage.setItem("latestBooking", JSON.stringify(payload.booking));
    localStorage.setItem("latestBookingReference", payload.booking.id);
    localStorage.setItem("latestBookingPhone", payload.booking.phoneNumber);
    window.location.href = `/success?id=${payload.booking.id}`;
  }

  async function captureCarPhoto(file: File | null) {
    if (!file) {
      update("carImageName", "");
      update("carImageDataUrl", "");
      return;
    }
    update("carImageName", file.name);
    update("carImageDataUrl", await compressImageFile(file));
  }

  return (
    <form id="booking" onSubmit={submitBooking} className="glass-panel relative w-full rounded-[8px] p-4 sm:p-6" dir={dir}>
      {submitting ? (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-[8px] bg-white/90 p-4 backdrop-blur-sm dark:bg-slate-950/90">
          <BurnoutLoader label={language === "ar" ? "جاري تأكيد طلبك" : "Submitting your booking"} />
        </div>
      ) : null}
      <div className="mb-6">
        <div className="text-sm font-bold text-sky-700">{t("mobileFirst")}</div>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{t("bookWash")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t("serviceScope")}</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((item, index) => {
          const locked = index > step + 1;
          return (
            <button
              key={item}
              type="button"
              onClick={() => goToStep(index)}
              disabled={locked}
              className={`min-w-0 text-start ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className={`h-2 rounded-full ${index <= step ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"}`} />
              <p className="mt-2 truncate text-[0.68rem] font-bold text-slate-600 dark:text-slate-300">{item}</p>
            </button>
          );
        })}
      </div>

      {errors.form ? <Alert>{errors.form}</Alert> : null}
      {confirmSubmitOpen ? (
        <div ref={confirmSubmitRef}>
          <ConfirmSubmitModal
            language={language}
            customerName={form.customerName}
            bookingDate={form.bookingDate ? formatDisplayDate(form.bookingDate, language) : "-"}
            area={selectedArea ? (language === "ar" ? selectedArea.nameAr : selectedArea.nameEn) : "-"}
            finalPrice={finalPrice}
            onCancel={() => setConfirmSubmitOpen(false)}
            onConfirm={submitConfirmedBooking}
          />
        </div>
      ) : null}

      <div className="grid gap-4">
        {step === 0 ? (
          <>
            <Field label={t("phoneNumber")} error={errors.phoneNumber}>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  name="phoneNumber"
                  className={fieldClass(errors.phoneNumber)}
                  inputMode="tel"
                  placeholder="01XXXXXXXXX"
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                  required
                />
                <button type="button" onClick={sendOtp} disabled={otpSending || !form.phoneNumber.trim() || Boolean(otpToken)} className={`inline-flex h-12 items-center justify-center rounded-[8px] px-4 text-sm font-black text-white disabled:opacity-80 ${otpToken ? "bg-emerald-500" : "bg-slate-950 dark:bg-white dark:text-slate-950"}`}>
                  {otpToken ? t("otpVerified") : otpSending ? t("sendingOtp") : otpSent ? t("resendOtp") : t("sendOtp")}
                </button>
              </div>
            </Field>
            {otpSent || otpToken ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="otpCode" className={fieldClass(errors.otp)} inputMode="numeric" value={otpCode} onChange={(event) => { setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setOtpToken(""); }} placeholder={t("otpCode")} />
                <button type="button" onClick={verifyOtpCode} disabled={otpVerifying || otpCode.length !== 6 || Boolean(otpToken)} className={`inline-flex h-12 items-center justify-center rounded-[8px] px-4 text-sm font-black text-white disabled:opacity-90 ${otpToken ? "bg-emerald-500" : "bg-sky-600 disabled:bg-slate-400"}`}>
                  {otpVerifying ? t("checking") : otpToken ? t("otpVerified") : t("verifyOtp")}
                </button>
              </div>
            ) : null}
            {(otpDevCode || errors.otp) ? (
              <div>
                {otpDevCode ? <p className="text-xs font-black text-sky-700">{t("devOtpCode")}: {otpDevCode}</p> : null}
              {errors.otp ? <p className="error-text">{errors.otp}</p> : null}
              </div>
            ) : null}
            <OtpProgress language={language} otpSent={otpSent} otpToken={Boolean(otpToken)} />
            {otpToken && returningLookupDone && lastBooking ? (
              <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">
                      {language === "ar" ? "مرحبًا بعودتك. وجدنا بيانات حجزك السابق." : "Welcome back. We found your previous booking details."}
                    </p>
                    <p className="mt-1 font-bold">
                      {lastBooking.carBrand} {lastBooking.carModel} - {lastBooking.areaName || lastBooking.area}
                    </p>
                  </div>
                  <button type="button" onClick={() => applyReturningBooking(lastBooking)} className="inline-flex h-12 items-center justify-center rounded-[8px] bg-emerald-600 px-5 text-sm font-black text-white shadow-sm">
                    {language === "ar" ? "احجز بنفس بيانات آخر مرة" : "Book with last details"}
                  </button>
                </div>
                {previousCars.length > 1 ? (
                  <div className="mt-4 grid gap-2">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-100">
                      {language === "ar" ? "أو اختر سيارة محفوظة:" : "Or choose a saved car:"}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {previousCars.map((booking) => {
                        const carKey = previousCarKey(booking);
                        const selected = selectedPreviousCarKey === carKey;
                        return (
                          <div
                            key={`${booking.carBrand}-${booking.carModel}-${booking.plateNumber || booking.id}`}
                            className={`rounded-[8px] p-2 text-xs font-black ring-1 transition ${
                              selected
                                ? "bg-emerald-600 text-white ring-emerald-700"
                                : "bg-white text-slate-800 ring-emerald-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-emerald-900"
                            }`}
                          >
                            <button type="button" onClick={() => applyReturningBooking(booking)} className="block w-full rounded-[8px] p-2 text-start hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30">
                              <span className="block">{booking.carBrand} {booking.carModel} {booking.carYear ? `- ${booking.carYear}` : ""}</span>
                              <span className={`mt-1 block ${selected ? "text-emerald-50" : "text-slate-500 dark:text-slate-300"}`}>{booking.carColor}{booking.plateNumber ? ` - ${booking.plateNumber}` : ""}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSavedCar(booking)}
                              className={`mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] text-xs font-black ${
                                selected ? "bg-white/15 text-white hover:bg-white/25" : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/35 dark:text-rose-200"
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {language === "ar" ? "حذف السيارة" : "Remove car"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {otpToken && returningLookupDone && !lastBooking ? (
              <div className="rounded-[8px] bg-slate-50 p-3 text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                {language === "ar" ? "لا توجد بيانات حجز سابقة لهذا الرقم." : "No previous booking details found for this phone."}
              </div>
            ) : null}
            <Field label={t("fullName")} error={errors.customerName}>
              <input name="customerName" className={fieldClass(errors.customerName)} value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
            </Field>
            <label className="flex items-start gap-3 rounded-[8px] bg-white/80 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
              <input name="consent" type="checkbox" className={`mt-1 h-4 w-4 accent-sky-600 ${errors.consent ? "ring-2 ring-rose-400" : ""}`} checked={form.consent} onChange={(e) => update("consent", e.target.checked)} />
              <span>{t("consent")}</span>
            </label>
            {errors.consent ? <p className="error-text">{errors.consent}</p> : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="rounded-[8px] bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {DEFAULT_GOVERNORATE.name[language]} - {DEFAULT_CITY.name[language]}
            </div>
            <Field label={t("area")} error={errors.area}>
              <select name="area" className={fieldClass(errors.area)} value={form.area} onChange={(e) => update("area", e.target.value)} required>
                <option value="">{t("chooseArea")}</option>
                {activeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {language === "ar" ? area.nameAr : area.nameEn} - {area.priceEgp} EGP
                  </option>
                ))}
              </select>
            </Field>
            {showAreaPriceWarning ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                {language === "ar"
                  ? `تنبيه: سعر المنطقة المختارة ${selectedArea?.priceEgp} EGP بدل ${previousAreaPrice} EGP في آخر حجز.`
                  : `Notice: the selected area price is ${selectedArea?.priceEgp} EGP instead of ${previousAreaPrice} EGP from your last booking.`}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
              <Field label={language === "ar" ? "اسم الشارع (اختياري)" : "Street name (optional)"}>
                <input name="address" className="field" value={form.address} onChange={(e) => update("address", e.target.value)} />
              </Field>
              <Field label={language === "ar" ? "رقم العمارة" : "Building number"} error={errors.buildingNumber}>
                <input name="buildingNumber" className={fieldClass(errors.buildingNumber)} value={form.buildingNumber} onChange={(e) => update("buildingNumber", e.target.value)} />
              </Field>
            </div>
            <Field label={language === "ar" ? "موقع السيارة (اختياري)" : "Car location (optional)"} error={errors.carLocation}>
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
                <input name="carLocation" className={fieldClass(errors.carLocation)} placeholder={t("mapsPlaceholder")} value={form.carLocation} onChange={(e) => update("carLocation", e.target.value)} />
              </div>
            </Field>
          </>
        ) : null}

        {step === 2 ? (
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
              <Field label={language === "ar" ? "سنة الصنع" : "Manufacture year"} error={errors.carYear}>
                <input name="carYear" className={fieldClass(errors.carYear)} inputMode="numeric" placeholder="2022" value={form.carYear} onChange={(e) => update("carYear", e.target.value.replace(/\D/g, "").slice(0, 4))} required />
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
                <input className="sr-only" type="file" accept="image/*" onChange={(e) => captureCarPhoto(e.target.files?.[0] || null)} />
              </label>
              {form.carImageDataUrl ? (
                <div className="mt-3 overflow-hidden rounded-[8px] border border-sky-200 bg-white dark:border-sky-900 dark:bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.carImageDataUrl} alt={form.carImageName || "Saved car photo"} className="max-h-56 w-full object-cover" />
                </div>
              ) : null}
            </Field>
            <Field label={t("notes")} error={errors.notes}>
              <textarea className="field min-h-28 resize-y" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </Field>
              <input name="website" className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Field label={`${t("bookingDate")} (${washWindow})`} error={errors.bookingDate}>
              <input name="bookingDate" className={fieldClass(errors.bookingDate)} type="date" min={earliestBookingDate} value={form.bookingDate} onChange={(e) => update("bookingDate", e.target.value)} />
              <p className="mt-2 rounded-[8px] bg-sky-50 p-3 text-xs font-bold leading-5 text-sky-900 dark:bg-sky-950/35 dark:text-sky-100">{bookingCloseNotice}</p>
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
                {upcomingDates.map((date) => {
                  const selected = date === form.bookingDate;
                  const dateClosedByCutoff = !isBookingDateAllowed(date, bookingNow);
                  const full = dateClosedByCutoff || (selected && capacity?.fullyBooked);
                  return (
                    <button
                      type="button"
                      key={date}
                      disabled={full}
                      onClick={() => update("bookingDate", date)}
                      className={`min-h-24 min-w-36 rounded-[8px] border p-2 text-start text-xs transition lg:min-w-0 ${
                        selected ? "border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      } ${full ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="block font-black">{formatDisplayDate(date, language)}</span>
                      <span className="mt-1 block text-[0.68rem]">{washWindow}</span>
                      {selected ? (
                        <span className="mt-1 block font-bold">
                          {loadingCapacity ? t("checking") : capacity?.reason === "cutoff" || bookingClosedByCutoff ? (language === "ar" ? "مغلق" : "Closed") : capacity?.fullyBooked ? t("fullyBooked") : `${capacity?.remaining ?? "-"} ${t("left")}`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={language === "ar" ? `${t("promoCode")} (اختياري)` : `${t("promoCode")} (optional)`} error={errors.promoCode}>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="promoCode" className={fieldClass(errors.promoCode)} value={form.promoCode} onChange={(e) => update("promoCode", e.target.value)} onBlur={verifyPromoCode} />
                <button type="button" onClick={verifyPromoCode} className="inline-flex h-12 items-center justify-center rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                  {language === "ar" ? "تحقق" : "Check"}
                </button>
              </div>
              {promoChecked && appliedPromo ? <span className="mt-2 block text-xs font-black text-emerald-600">{appliedPromo.label} - {promoDisplayValue(appliedPromo)}</span> : null}
            </Field>
            <label className={`flex items-start gap-3 rounded-[8px] p-3 text-sm font-bold leading-6 ${canRedeemLoyalty ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100" : "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-300"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" disabled={!canRedeemLoyalty} checked={form.loyaltyRewardRedeemed && canRedeemLoyalty} onChange={(e) => update("loyaltyRewardRedeemed", e.target.checked)} />
              <span>
                {language === "ar" ? `رصيدك ${loyaltyBalance} نقطة. ${canRedeemLoyalty ? "استخدم 100 نقطة للحصول على غسلة مجانية." : "كل غسلة مكتملة = 10 نقاط، و100 نقطة = غسلة مجانية."}` : `You have ${loyaltyBalance} points. ${canRedeemLoyalty ? "Redeem 100 points for a free wash." : "Every completed wash earns 10 points. 100 points = free wash."}`}
              </span>
            </label>
            <div className="rounded-[8px] border border-sky-200 bg-sky-50 p-4 text-slate-950 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-600 dark:text-slate-300">{t("servicePrice")}</span>
                <span className="font-black">{basePrice} EGP</span>
              </div>
              {selectedArea ? (
                <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-300">
                  <span>{t("area")}</span>
                  <span>{language === "ar" ? selectedArea.nameAr : selectedArea.nameEn}</span>
                </div>
              ) : null}
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

        <div className="sticky bottom-2 z-10 mt-2 rounded-[8px] border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 lg:static lg:shadow-sm">
          <div className="mb-2 grid grid-cols-3 gap-2 rounded-[8px] bg-slate-50 p-2 text-xs dark:bg-slate-900">
            <div>
              <span className="block font-bold text-slate-500">{t("area")}</span>
              <span className="block truncate font-black text-slate-950 dark:text-white">{selectedArea ? (language === "ar" ? selectedArea.nameAr : selectedArea.nameEn) : "-"}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-500">{t("bookingDate")}</span>
              <span className="block truncate font-black text-slate-950 dark:text-white">
                {step >= 3 && form.bookingDate ? formatDisplayDate(form.bookingDate, language) : "-"}
              </span>
            </div>
            <div>
              <span className="block font-bold text-slate-500">{t("finalPrice")}</span>
              <span className="block truncate font-black text-sky-700 dark:text-sky-300">{finalPrice} EGP</span>
            </div>
          </div>
          <div className="flex gap-3">
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
            <button type="submit" disabled={submitting || bookingClosed} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {t("submit")}
            </button>
          )}
          </div>
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

function OtpProgress({ language, otpSent, otpToken }: { language: "en" | "ar"; otpSent: boolean; otpToken: boolean }) {
  const items = [
    { done: true, label: language === "ar" ? "رقم الهاتف" : "Phone" },
    { done: otpSent || otpToken, label: language === "ar" ? "إرسال الكود" : "Code sent" },
    { done: otpToken, label: language === "ar" ? "تم التحقق" : "Verified" }
  ];

  return (
    <div className="grid grid-cols-3 gap-2 rounded-[8px] bg-slate-50 p-2 dark:bg-slate-900">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className={`h-1.5 rounded-full ${item.done ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
          <p className={`mt-1 truncate text-[0.68rem] font-black ${item.done ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function ConfirmSubmitModal({
  language,
  customerName,
  bookingDate,
  area,
  finalPrice,
  onCancel,
  onConfirm
}: {
  language: "en" | "ar";
  customerName: string;
  bookingDate: string;
  area: string;
  finalPrice: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" onClick={onCancel}>
      <section className="w-full max-w-md rounded-[8px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-xl font-black">{language === "ar" ? "تأكيد بيانات الحجز" : "Confirm booking details"}</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
          {language === "ar" ? "راجع البيانات قبل إرسال طلب الحجز." : "Review the details before submitting your booking request."}
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <ConfirmRow label={language === "ar" ? "الاسم" : "Name"} value={customerName || "-"} />
          <ConfirmRow label={language === "ar" ? "التاريخ" : "Date"} value={bookingDate} />
          <ConfirmRow label={language === "ar" ? "المنطقة" : "Area"} value={area} />
          <ConfirmRow label={language === "ar" ? "السعر النهائي" : "Final price"} value={`${finalPrice} EGP`} />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-slate-100 px-4 text-sm font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {language === "ar" ? "رجوع" : "Back"}
          </button>
          <button type="button" onClick={onConfirm} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
            {language === "ar" ? "تأكيد وإرسال" : "Confirm and submit"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <span className="font-bold text-slate-500 dark:text-slate-300">{label}</span>
      <span className="text-end font-black">{value}</span>
    </div>
  );
}

function translateServerErrors(errors: Record<string, string>, t: (key: "requiredOtp" | "duplicatePlateBooking" | "tooManyBookingsFromPhone" | "tooManySavedCars") => string) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [
      key,
      value === "Verify your phone number before booking."
        ? t("requiredOtp")
        : value === "This plate number already has a booking for this date."
          ? t("duplicatePlateBooking")
          : value === "Too many bookings from this phone number. Please try again later."
            ? t("tooManyBookingsFromPhone")
            : value === "This phone number already has 3 saved cars. Remove an old saved car before adding another one."
              ? t("tooManySavedCars")
              : value
    ])
  );
}

function otpApiErrorMessage(
  error: string | undefined,
  t: (key: "genericError" | "invalidOtp" | "requiredPhone" | "tooManyOtpRequests" | "tooManyOtpAttempts") => string,
  fallback: "genericError" | "invalidOtp" = "genericError"
) {
  if (error === "Too many OTP requests.") return t("tooManyOtpRequests");
  if (error === "Too many OTP attempts.") return t("tooManyOtpAttempts");
  if (error === "Invalid phone number.") return t("requiredPhone");
  return t(fallback);
}

function normalizePlateLetters(value: string) {
  return value
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 4)
    .split("")
    .join(" ");
}

function splitPlateNumber(value?: string) {
  const [letters = "", digits = ""] = (value || "").split(" - ");
  return {
    plateLetters: normalizePlateLetters(letters),
    plateDigits: digits.replace(/\D/g, "").slice(0, 6)
  };
}

function uniquePreviousCars(bookings: Booking[]) {
  const seen = new Set<string>();
  return bookings.filter((booking) => {
    const key = previousCarKey(booking);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function previousCarKey(booking: Booking) {
  return [
    booking.carBrand,
    booking.carModel,
    booking.carYear || "",
    booking.carColor,
    booking.plateNumber || ""
  ].join("|").toLowerCase();
}

function compressImageFile(file: File, maxSize = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        resolve("");
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(reader.result as string);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.onerror = () => resolve(reader.result as string);
      image.src = reader.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
