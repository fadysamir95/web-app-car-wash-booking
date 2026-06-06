import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SERVICE, PROMO_CODES, SERVICE_CONFIG } from "./constants";
import { finalPriceFromPromo } from "./pricing";
import type { Booking, BookingCapacity, BookingInput, PromoCode } from "./types";

const dataDir = path.join(process.cwd(), "data");
const bookingsPath = path.join(dataDir, "bookings.json");
const promosPath = path.join(dataDir, "promos.json");
const pendingBookingExpiryMs = 3 * 60 * 60 * 1000;

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(bookingsPath, "utf8");
  } catch {
    await writeFile(bookingsPath, "[]", "utf8");
  }
  try {
    await readFile(promosPath, "utf8");
  } catch {
    await writeFile(promosPath, JSON.stringify(defaultPromoCodes(), null, 2), "utf8");
  }
}

export async function readBookings(): Promise<Booking[]> {
  await ensureDataFile();
  const content = await readFile(bookingsPath, "utf8");
  try {
    const bookings = migrateBookings(JSON.parse(content) as Booking[]);
    return await expirePendingBookings(bookings);
  } catch {
    return [];
  }
}

async function writeBookings(bookings: Booking[]) {
  await ensureDataFile();
  await writeFile(bookingsPath, JSON.stringify(bookings, null, 2), "utf8");
}

export async function readPromoCodes(): Promise<PromoCode[]> {
  await ensureDataFile();
  const content = await readFile(promosPath, "utf8");
  try {
    return JSON.parse(content) as PromoCode[];
  } catch {
    return defaultPromoCodes();
  }
}

export async function writePromoCodes(promos: PromoCode[]) {
  await ensureDataFile();
  await writeFile(promosPath, JSON.stringify(promos, null, 2), "utf8");
}

export async function createPromoCode(promo: PromoCode) {
  const promos = await readPromoCodes();
  const code = promo.code.trim().toLowerCase();
  if (!code || promos.some((item) => item.code === code)) return null;
  const next = [{ ...promo, code }, ...promos];
  await writePromoCodes(next);
  return next;
}

export async function deletePromoCode(code: string) {
  const promos = await readPromoCodes();
  const next = promos.filter((promo) => promo.code !== code);
  if (next.length === promos.length) return null;
  await writePromoCodes(next);
  return next;
}

async function expirePendingBookings(bookings: Booking[]) {
  const now = Date.now();
  let changed = false;

  const next = bookings.map((booking) => {
    const isExpiredPending =
      booking.bookingStatus === "Pending" &&
      booking.paymentStatus === "Pending" &&
      now - new Date(booking.createdAt).getTime() >= pendingBookingExpiryMs;

    if (!isExpiredPending) return booking;
    changed = true;
    return {
      ...booking,
      bookingStatus: "Cancelled" as const,
      paymentStatus: "Rejected" as const,
      cancellationReason: "Payment was not received within 3 hours.",
      timeline: [
        ...booking.timeline,
        {
          status: "Cancelled" as const,
          label: "Auto cancelled",
          note: "Payment was not received within 3 hours.",
          createdAt: new Date().toISOString()
        }
      ]
    };
  });

  if (changed) await writeBookings(next);
  return next;
}

export function countActiveBookingsForDate(bookings: Booking[], date: string) {
  return bookings.filter(
    (booking) => booking.bookingDate === date && booking.bookingStatus !== "Cancelled"
  ).length;
}

export async function getCapacity(date: string): Promise<BookingCapacity> {
  const bookings = await readBookings();
  const count = countActiveBookingsForDate(bookings, date);
  return {
    date,
    count,
    remaining: Math.max(SERVICE_CONFIG.maxBookingsPerDay - count, 0),
    fullyBooked: count >= SERVICE_CONFIG.maxBookingsPerDay
  };
}

export async function createBooking(input: BookingInput) {
  const bookings = await readBookings();
  const promoCodes = await readPromoCodes();
  const count = countActiveBookingsForDate(bookings, input.bookingDate);

  if (count >= SERVICE_CONFIG.maxBookingsPerDay) {
    return { ok: false as const, error: "This date is fully booked. Please choose another date." };
  }

  const samePhoneBookingsToday = bookings.filter(
    (booking) =>
      booking.phoneNumber === input.phoneNumber &&
      booking.bookingDate === input.bookingDate &&
      booking.bookingStatus !== "Cancelled"
  ).length;
  if (samePhoneBookingsToday >= 2) {
    return { ok: false as const, error: "This phone number already has the maximum bookings for this date." };
  }

  if (input.plateNumber) {
    const duplicatePlate = bookings.some(
      (booking) =>
        booking.plateNumber &&
        booking.plateNumber.replace(/\s/g, "").toUpperCase() === input.plateNumber?.replace(/\s/g, "").toUpperCase() &&
        booking.bookingDate === input.bookingDate &&
        booking.bookingStatus !== "Cancelled"
    );
    if (duplicatePlate) {
      return { ok: false as const, error: "This plate number already has a booking for this date." };
    }
  }

  const appliedPromo = input.promoCode ? activePromoCodes(promoCodes).find((promo) => promo.code === input.promoCode) : null;
  const finalPrice = finalPriceFromPromo(appliedPromo);
  const isFreeBooking = finalPrice === 0;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + pendingBookingExpiryMs);

  const booking: Booking = {
    id: createBookingReference(),
    customerId: `cust_${input.phoneNumber}`,
    ...input,
    consent: true,
    washWindowAcknowledged: true,
    bookingTimeWindow: DEFAULT_SERVICE.bookingWindow,
    finalPriceEgp: finalPrice,
    loyaltyPoints: input.loyaltyPoints || 0,
    paymentStatus: isFreeBooking ? "Verified" : "Pending",
    bookingStatus: isFreeBooking ? "Confirmed" : "Pending",
    expiresAt: isFreeBooking ? undefined : expiresAt.toISOString(),
    timeline: [
      {
        status: isFreeBooking ? "Confirmed" : "Pending",
        label: isFreeBooking ? "Booking confirmed" : "Booking submitted",
        note: isFreeBooking ? "Free wash promo applied." : "Awaiting payment confirmation.",
        createdAt: createdAt.toISOString()
      }
    ],
    createdAt: createdAt.toISOString()
  };

  await writeBookings([booking, ...bookings]);
  return { ok: true as const, booking };
}

function createBookingReference() {
  return `CW-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function defaultPromoCodes(): PromoCode[] {
  return PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount" as const, active: true }));
}

export function activePromoCodes(promos: PromoCode[]) {
  const now = new Date().toISOString();
  return promos.filter((promo) => promo.active && (!promo.expiresAt || promo.expiresAt >= now));
}

export async function updateBookingStatus(
  id: string,
  updates: Partial<Pick<Booking, "paymentStatus" | "bookingStatus">>
) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return null;

  Object.assign(booking, normalizeStatusUpdates(updates));
  if (updates.bookingStatus && booking.timeline.at(-1)?.status !== updates.bookingStatus) {
    booking.timeline.push({
      status: updates.bookingStatus,
      label: `Status changed to ${updates.bookingStatus}`,
      createdAt: new Date().toISOString()
    });
  }
  await writeBookings(bookings);
  return booking;
}

function migrateBookings(bookings: Booking[]) {
  let changed = false;
  const migrated = bookings.map((booking) => {
    const next = { ...booking };
    if (!next.timeline) {
      changed = true;
      next.timeline = [
        {
          status: next.bookingStatus,
          label: `Current status: ${next.bookingStatus}`,
          createdAt: next.createdAt
        }
      ];
    }
    if (next.bookingStatus === "Pending" && next.paymentStatus === "Pending" && !next.expiresAt) {
      changed = true;
      next.expiresAt = new Date(new Date(next.createdAt).getTime() + pendingBookingExpiryMs).toISOString();
    }
    return next;
  });
  if (changed) void writeBookings(migrated);
  return migrated;
}

export async function deleteBookingData(id: string) {
  const bookings = await readBookings();
  const remaining = bookings.filter((booking) => booking.id !== id);
  if (remaining.length === bookings.length) return null;

  await writeBookings(remaining);
  return remaining;
}

export async function updateCustomerData(
  phoneNumber: string,
  updates: Partial<Pick<Booking, "customerName" | "phoneNumber" | "carBrand" | "carModel" | "carColor" | "plateNumber">>
) {
  const bookings = await readBookings();
  const customerBookings = bookings.filter((booking) => booking.phoneNumber === phoneNumber);
  if (customerBookings.length === 0) return null;

  const nextPhone = updates.phoneNumber || phoneNumber;
  for (const booking of customerBookings) {
    if (updates.customerName) booking.customerName = updates.customerName;
    if (updates.phoneNumber) {
      booking.phoneNumber = updates.phoneNumber;
      booking.customerId = `cust_${nextPhone}`;
    }
    if (updates.carBrand) booking.carBrand = updates.carBrand;
    if (updates.carModel) booking.carModel = updates.carModel;
    if (updates.carColor) booking.carColor = updates.carColor;
    if (updates.plateNumber !== undefined) booking.plateNumber = updates.plateNumber || undefined;
  }

  await writeBookings(bookings);
  return bookings;
}

export async function deleteCustomerData(phoneNumber: string) {
  const bookings = await readBookings();
  const remaining = bookings.filter((booking) => booking.phoneNumber !== phoneNumber);
  if (remaining.length === bookings.length) return null;

  await writeBookings(remaining);
  return remaining;
}

function normalizeStatusUpdates(updates: Partial<Pick<Booking, "paymentStatus" | "bookingStatus">>) {
  if (updates.bookingStatus === "Pending") return { ...updates, paymentStatus: "Pending" as const };
  if (updates.bookingStatus === "Confirmed" || updates.bookingStatus === "Completed") {
    return { ...updates, paymentStatus: "Verified" as const };
  }
  if (updates.bookingStatus === "Cancelled") return { ...updates, paymentStatus: "Rejected" as const };
  return updates;
}
