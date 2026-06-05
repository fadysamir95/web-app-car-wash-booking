import { BOOKING_STATUSES, PAYMENT_STATUSES, SERVICE_CONFIG, type BookingStatus, type PaymentStatus } from "./constants";
import { isBookingDateAllowed } from "./date";
import type { BookingInput } from "./types";

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

export function validateBookingInput(raw: unknown): ValidationResult<BookingInput> {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const customerName = normalizeString(source.customerName);
  const phoneNumber = normalizePhone(normalizeString(source.phoneNumber));
  const carType = normalizeString(source.carType);
  const plateNumber = normalizeString(source.plateNumber).toUpperCase();
  const carImageName = normalizeString(source.carImageName);
  const area = normalizeString(source.area);
  const address = normalizeString(source.address);
  const buildingNumber = normalizeString(source.buildingNumber);
  const carLocation = normalizeString(source.carLocation);
  const bookingDate = normalizeString(source.bookingDate);
  const notes = normalizeString(source.notes);
  const promoCode = normalizeString(source.promoCode).toUpperCase();
  const consent = source.consent === true;

  if (customerName.length < 3) errors.customerName = "Enter the full customer name.";
  if (!egyptPhonePattern.test(phoneNumber)) errors.phoneNumber = "Enter a valid Egyptian mobile number.";
  if (carType.length < 2) errors.carType = "Enter car color and model.";
  if (plateNumber.length < 2) errors.plateNumber = "Enter the car plate number.";
  if (!SERVICE_CONFIG.areas.includes(area as never)) errors.area = "Choose one of the supported areas.";
  if (address.length < 6) errors.address = "Enter a clear detailed address.";
  if (!buildingNumber) errors.buildingNumber = "Enter the building number.";
  if (carLocation.length < 5) errors.carLocation = "Share geolocation or paste a Google Maps link.";
  if (!isBookingDateAllowed(bookingDate)) errors.bookingDate = "The earliest available booking date is tomorrow.";
  if (!consent) errors.consent = "Consent is required to complete the booking.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      customerName,
      phoneNumber,
      carType,
      plateNumber,
      carImageName: carImageName || undefined,
      area: area as BookingInput["area"],
      address,
      buildingNumber,
      carLocation,
      bookingDate,
      notes: notes || undefined,
      promoCode: promoCode || undefined,
      consent
    }
  };
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}
