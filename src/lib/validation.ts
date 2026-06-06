import {
  BOOKING_STATUSES,
  DEFAULT_CITY,
  DEFAULT_GOVERNORATE,
  PROMO_CODES,
  SERVICE_AREAS,
  type BookingStatus,
} from "./constants";
import { isBookingDateAllowed } from "./date";
import type { BookingInput, PromoCode } from "./types";
import type { ServiceSettings } from "./types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> };

const egyptPhonePattern = /^(?:\+20|0020|0)?1[0125]\d{8}$/;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+20")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0020")) return `0${digits.slice(4)}`;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function validateBookingInput(
  raw: unknown,
  promoCodes: readonly PromoCode[] = PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })),
  settings?: ServiceSettings
): ValidationResult<BookingInput> {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const customerName = normalizeString(source.customerName);
  const phoneNumber = normalizePhone(normalizeString(source.phoneNumber));
  const carBrand = normalizeString(source.carBrand);
  const carModel = normalizeString(source.carModel);
  const carColor = normalizeString(source.carColor);
  const carYear = normalizeString(source.carYear);
  const plateNumber = normalizeString(source.plateNumber).toUpperCase();
  const carImageName = normalizeString(source.carImageName);
  const carImageDataUrl = normalizeString(source.carImageDataUrl);
  const area = normalizeString(source.area);
  const address = normalizeString(source.address);
  const buildingNumber = normalizeString(source.buildingNumber);
  const carLocation = normalizeString(source.carLocation);
  const bookingDate = normalizeString(source.bookingDate);
  const notes = normalizeString(source.notes);
  const promoCode = normalizeString(source.promoCode).toLowerCase();
  const sourceLanguage = normalizeString(source.sourceLanguage) === "ar" ? "ar" : "en";
  const consent = source.consent === true;
  const washWindowAcknowledged = source.washWindowAcknowledged === true;
  const honeypot = normalizeString(source.website);

  if (customerName.length < 3) errors.customerName = "Enter the full customer name.";
  if (!egyptPhonePattern.test(phoneNumber)) errors.phoneNumber = "Enter a valid Egyptian mobile number.";
  if (carBrand.length < 2) errors.carBrand = "Enter or choose the car brand.";
  if (carModel.length < 1) errors.carModel = "Enter the car model.";
  if (carColor.length < 2) errors.carColor = "Enter the car color.";
  if (!/^(19[8-9]\d|20[0-2]\d)$/.test(carYear)) errors.carYear = "Enter a valid manufacture year.";
  const activeAreas: Array<{ id: string; nameEn: string }> = settings?.areas.filter((item) => item.active).map((item) => ({
    id: item.id,
    nameEn: item.nameEn
  })) || SERVICE_AREAS.map((item) => ({
    id: item.id,
    nameEn: item.name.en
  }));
  if (!activeAreas.some((item) => item.id === area)) errors.area = "Choose one of the supported areas.";
  if (buildingNumber.length < 1) errors.buildingNumber = "Enter the building number.";
  if (!isBookingDateAllowed(bookingDate)) errors.bookingDate = "Booking for this wash date is closed. The latest booking time is 12:00 AM when the wash day starts.";
  if (promoCode && !promoCodes.some((promo) => promo.active && promo.code === promoCode)) errors.promoCode = "This promo code is not valid.";
  if (!consent) errors.consent = "Consent is required to complete the booking.";
  if (!washWindowAcknowledged) errors.washWindowAcknowledged = "You must acknowledge the wash time window.";
  if (honeypot) errors.form = "Unable to submit this booking.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const selectedArea = activeAreas.find((item) => item.id === area)!;

  return {
    ok: true,
    data: {
      customerName,
      phoneNumber,
      carBrand,
      carModel,
      carColor,
      carYear,
      plateNumber: plateNumber || undefined,
      carImageName: carImageName || undefined,
      carImageDataUrl: carImageDataUrl.startsWith("data:image/") ? carImageDataUrl : undefined,
      governorate: DEFAULT_GOVERNORATE.id,
      city: DEFAULT_CITY.id,
      area,
      areaName: selectedArea.nameEn,
      address: address || undefined,
      buildingNumber: buildingNumber || undefined,
      carLocation: carLocation || undefined,
      bookingDate,
      notes: notes || undefined,
      promoCode: promoCode || undefined,
      loyaltyPoints: 0,
      marketingConsent: consent,
      consent,
      washWindowAcknowledged,
      sourceLanguage
    }
  };
}

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}
