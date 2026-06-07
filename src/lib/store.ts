import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SERVICE, PROMO_CODES, SERVICE_CONFIG } from "./constants";
import { isBookingDateAllowed } from "./date";
import { finalPriceFromPromo } from "./pricing";
import type { Booking, BookingCapacity, BookingInput, CustomerComplaint, PromoCode, ServiceSettings } from "./types";

const dataDir = path.join(process.cwd(), "data");
const bookingsPath = path.join(dataDir, "bookings.json");
const promosPath = path.join(dataDir, "promos.json");
const settingsPath = path.join(dataDir, "settings.json");
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
  try {
    await readFile(settingsPath, "utf8");
  } catch {
    await writeFile(settingsPath, JSON.stringify(defaultServiceSettings(), null, 2), "utf8");
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

export async function readSettings(): Promise<ServiceSettings> {
  await ensureDataFile();
  const content = await readFile(settingsPath, "utf8");
  try {
    return normalizeSettings(JSON.parse(content) as Partial<ServiceSettings>);
  } catch {
    return defaultServiceSettings();
  }
}

export async function writeSettings(settings: ServiceSettings) {
  await ensureDataFile();
  const normalized = normalizeSettings(settings);
  await writeFile(settingsPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
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

export async function updatePromoCode(code: string, updates: Omit<PromoCode, "code">) {
  const promos = await readPromoCodes();
  const promoIndex = promos.findIndex((promo) => promo.code === code.trim().toLowerCase());
  if (promoIndex === -1) return null;

  const next = promos.map((promo, index) => (index === promoIndex ? { ...promo, ...updates, code: promo.code } : promo));
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
  const settings = await readSettings();
  const count = countActiveBookingsForDate(bookings, date);
  const cutoffClosed = !isBookingDateAllowed(date);
  const capacityClosed = count >= settings.maxBookingsPerDay;
  return {
    date,
    count,
    remaining: Math.max(settings.maxBookingsPerDay - count, 0),
    fullyBooked: capacityClosed || cutoffClosed,
    closed: capacityClosed || cutoffClosed,
    reason: cutoffClosed ? "cutoff" : capacityClosed ? "capacity" : undefined
  };
}

export async function createBooking(input: BookingInput) {
  const bookings = await readBookings();
  const promoCodes = await readPromoCodes();
  const settings = await readSettings();
  const count = countActiveBookingsForDate(bookings, input.bookingDate);

  if (!isBookingDateAllowed(input.bookingDate)) {
    return { ok: false as const, error: "Booking for this wash date is closed. The latest booking time is 12:00 AM when the wash day starts." };
  }

  if (count >= settings.maxBookingsPerDay) {
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
  const selectedArea = settings.areas.find((area) => area.id === input.area && area.active);
  const basePrice = selectedArea?.priceEgp ?? settings.servicePriceEgp;
  const finalPrice = finalPriceFromPromo(appliedPromo, basePrice);
  const isFreeBooking = finalPrice === 0;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + pendingBookingExpiryMs);

  const booking: Booking = {
    id: createBookingReference(),
    customerId: `cust_${input.phoneNumber}`,
    ...input,
    consent: true,
    washWindowAcknowledged: true,
    bookingTimeWindow: settings.washWindow,
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
  updates: Partial<Pick<Booking, "paymentStatus" | "bookingStatus" | "completedByWorkerId" | "cancellationReason">>
) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return null;

  Object.assign(booking, normalizeStatusUpdates(updates));
  if (updates.bookingStatus === "Completed" && updates.completedByWorkerId) {
    booking.completedByWorkerId = updates.completedByWorkerId;
  }
  if (updates.bookingStatus === "Cancelled" && updates.cancellationReason) {
    booking.cancellationReason = updates.cancellationReason;
  }
  if (updates.bookingStatus && booking.timeline.at(-1)?.status !== updates.bookingStatus) {
    booking.timeline.push({
      status: updates.bookingStatus,
      label: `Status changed to ${updates.bookingStatus}`,
      note: updates.cancellationReason || (updates.completedByWorkerId ? `Completed by worker ${updates.completedByWorkerId}` : undefined),
      createdAt: new Date().toISOString()
    });
  }
  await writeBookings(bookings);
  return booking;
}

export async function rateBooking(id: string, rating: number, ratingComment?: string) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking || booking.bookingStatus !== "Completed") return null;

  booking.rating = Math.min(Math.max(Math.round(rating), 1), 5);
  booking.ratingComment = ratingComment?.trim() || undefined;
  booking.ratedAt = new Date().toISOString();
  booking.timeline.push({
    status: "Completed",
    label: "Service rated",
    note: `${booking.rating}/5${booking.ratingComment ? ` - ${booking.ratingComment}` : ""}`,
    createdAt: booking.ratedAt
  });

  await writeBookings(bookings);
  return booking;
}

export async function addBookingComplaint(id: string, complaint: CustomerComplaint) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking || !booking.rating || booking.rating >= 3) return null;

  booking.complaint = complaint;
  booking.timeline.push({
    status: booking.bookingStatus,
    label: "Customer complaint received",
    note: complaint.text,
    createdAt: complaint.createdAt
  });

  await writeBookings(bookings);
  return booking;
}

export async function completeBookingWithProof(
  id: string,
  proof: { imageName: string; imageDataUrl: string; workerId?: string }
) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return null;

  const now = new Date().toISOString();
  Object.assign(booking, normalizeStatusUpdates({ bookingStatus: "Completed" }));
  booking.washProofImageName = proof.imageName;
  booking.washProofImageDataUrl = proof.imageDataUrl;
  booking.washProofUploadedAt = now;
  booking.completedByWorkerId = proof.workerId;
  booking.timeline.push({
    status: "Completed",
    label: "Vehicle washed with proof",
    note: proof.imageName,
    createdAt: now
  });

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

function defaultServiceSettings(): ServiceSettings {
  const areaNamesAr: Record<string, string> = {
    "degla-palms": "دجلة بالمز",
    "800-feddan": "800 فدان",
    "sakan-misr": "سكن مصر",
    "ebni-betak": "ابني بيتك"
  };
  return {
    servicePriceEgp: DEFAULT_SERVICE.priceEgp,
    paymentPhone: SERVICE_CONFIG.paymentPhone,
    maxBookingsPerDay: SERVICE_CONFIG.maxBookingsPerDay,
    washWindow: DEFAULT_SERVICE.bookingWindow,
    washWindowAr: "12:00 صباحًا إلى 5:00 صباحًا",
    areas: SERVICE_CONFIG.governorates[0].cities[0].areas.map((area) => ({
      id: area.id,
      nameEn: area.name.en,
      nameAr: areaNamesAr[area.id] || area.name.en,
      priceEgp: area.priceEgp,
      active: true
    }))
  };
}

function normalizeSettings(settings: Partial<ServiceSettings>): ServiceSettings {
  const defaults = defaultServiceSettings();
  const areas = Array.isArray(settings.areas) && settings.areas.length > 0 ? settings.areas : defaults.areas;
  return {
    servicePriceEgp: positiveNumber(settings.servicePriceEgp, defaults.servicePriceEgp),
    paymentPhone: String(settings.paymentPhone || defaults.paymentPhone).replace(/\D/g, "") || defaults.paymentPhone,
    maxBookingsPerDay: Math.max(1, Math.min(100, Math.round(positiveNumber(settings.maxBookingsPerDay, defaults.maxBookingsPerDay)))),
    washWindow: String(settings.washWindow || defaults.washWindow).trim(),
    washWindowAr: String(settings.washWindowAr || defaults.washWindowAr).trim(),
    areas: areas.map((area) => ({
      id: String(area.id || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      nameEn: String(area.nameEn || "").trim() || "Area",
      nameAr: String(area.nameAr || area.nameEn || "").trim() || "منطقة",
      priceEgp: positiveNumber(area.priceEgp, settings.servicePriceEgp || defaults.servicePriceEgp),
      active: area.active !== false
    })).filter((area) => area.id)
  };
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function deleteBookingData(id: string) {
  const bookings = await readBookings();
  const remaining = bookings.filter((booking) => booking.id !== id);
  if (remaining.length === bookings.length) return null;

  await writeBookings(remaining);
  return remaining;
}

export async function deleteAllBookingData() {
  await writeBookings([]);
  return [];
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
