import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SERVICE, SERVICE_CONFIG } from "./constants";
import type { Booking, BookingCapacity, BookingInput } from "./types";

const dataDir = path.join(process.cwd(), "data");
const bookingsPath = path.join(dataDir, "bookings.json");

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(bookingsPath, "utf8");
  } catch {
    await writeFile(bookingsPath, "[]", "utf8");
  }
}

export async function readBookings(): Promise<Booking[]> {
  await ensureDataFile();
  const content = await readFile(bookingsPath, "utf8");
  try {
    return JSON.parse(content) as Booking[];
  } catch {
    return [];
  }
}

async function writeBookings(bookings: Booking[]) {
  await ensureDataFile();
  await writeFile(bookingsPath, JSON.stringify(bookings, null, 2), "utf8");
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
  const count = countActiveBookingsForDate(bookings, input.bookingDate);

  if (count >= SERVICE_CONFIG.maxBookingsPerDay) {
    return { ok: false as const, error: "This date is fully booked. Please choose another date." };
  }

  const booking: Booking = {
    id: createBookingReference(),
    customerId: `cust_${input.phoneNumber}`,
    ...input,
    consent: true,
    washWindowAcknowledged: true,
    bookingTimeWindow: DEFAULT_SERVICE.bookingWindow,
    loyaltyPoints: input.loyaltyPoints || 0,
    paymentStatus: "Pending",
    bookingStatus: "Pending Payment",
    createdAt: new Date().toISOString()
  };

  await writeBookings([booking, ...bookings]);
  return { ok: true as const, booking };
}

function createBookingReference() {
  return `CW-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function updateBookingStatus(
  id: string,
  updates: Partial<Pick<Booking, "paymentStatus" | "bookingStatus">>
) {
  const bookings = await readBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return null;

  Object.assign(booking, updates);
  await writeBookings(bookings);
  return booking;
}
