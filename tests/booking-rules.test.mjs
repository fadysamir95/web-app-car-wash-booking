import assert from "node:assert/strict";
import { test } from "node:test";

const DAILY_CAPACITY = 20;

function normalizePlate(letters, numbers) {
  return `${letters || ""}-${numbers || ""}`.replace(/\s+/g, "").toLowerCase();
}

function canAcceptBooking(bookings, nextBooking) {
  const sameDate = bookings.filter((booking) => booking.bookingDate === nextBooking.bookingDate);
  if (sameDate.length >= DAILY_CAPACITY) return { ok: false, reason: "capacity" };

  const nextPlate = normalizePlate(nextBooking.plateLetters, nextBooking.plateNumbers);
  const hasDuplicatePlate = Boolean(nextPlate) && sameDate.some((booking) => normalizePlate(booking.plateLetters, booking.plateNumbers) === nextPlate);
  if (hasDuplicatePlate) return { ok: false, reason: "duplicate_plate" };

  return { ok: true };
}

function verifyOtpToken(tokenStore, phone, code, now = Date.now()) {
  const token = tokenStore.get(phone);
  if (!token || token.code !== code || token.expiresAt <= now) return false;
  return true;
}

function consumeOtpToken(tokenStore, phone) {
  tokenStore.delete(phone);
}

function awardLoyaltyPoints(customers, phone, booking) {
  const customer = customers.get(phone) || { loyaltyPoints: 0 };
  if (booking.bookingStatus === "Completed" && !booking.loyaltyPointsAwarded) {
    customer.loyaltyPoints += 10;
    booking.loyaltyPointsAwarded = 10;
  }
  customers.set(phone, customer);
  return customer.loyaltyPoints;
}

function redeemFreeWash(customer) {
  if (customer.loyaltyPoints < 100) return false;
  customer.loyaltyPoints -= 100;
  return true;
}

test("booking capacity blocks the 21st booking for the same date", () => {
  const bookings = Array.from({ length: DAILY_CAPACITY }, (_, index) => ({
    bookingDate: "2026-06-08",
    plateLetters: "A B C",
    plateNumbers: String(1000 + index)
  }));

  assert.deepEqual(canAcceptBooking(bookings, { bookingDate: "2026-06-08", plateLetters: "D E F", plateNumbers: "9090" }), {
    ok: false,
    reason: "capacity"
  });
  assert.deepEqual(canAcceptBooking(bookings, { bookingDate: "2026-06-09", plateLetters: "D E F", plateNumbers: "9090" }), { ok: true });
});

test("duplicate plate is blocked only on the same booking date", () => {
  const bookings = [{ bookingDate: "2026-06-08", plateLetters: "ط و م", plateNumbers: "6725" }];

  assert.deepEqual(canAcceptBooking(bookings, { bookingDate: "2026-06-08", plateLetters: "طوم", plateNumbers: "6725" }), {
    ok: false,
    reason: "duplicate_plate"
  });
  assert.deepEqual(canAcceptBooking(bookings, { bookingDate: "2026-06-09", plateLetters: "طوم", plateNumbers: "6725" }), { ok: true });
});

test("OTP remains usable after a failed submit and is consumed after success", () => {
  const tokens = new Map([["01208878827", { code: "123456", expiresAt: Date.now() + 60_000 }]]);

  assert.equal(verifyOtpToken(tokens, "01208878827", "123456"), true);
  assert.equal(tokens.has("01208878827"), true);

  consumeOtpToken(tokens, "01208878827");
  assert.equal(verifyOtpToken(tokens, "01208878827", "123456"), false);
});

test("completed bookings award loyalty points and support free wash redemption", () => {
  const customers = new Map();
  const booking = { bookingStatus: "Completed", loyaltyPointsAwarded: 0 };

  assert.equal(awardLoyaltyPoints(customers, "01208878827", booking), 10);
  assert.equal(awardLoyaltyPoints(customers, "01208878827", booking), 10);

  const customer = customers.get("01208878827");
  customer.loyaltyPoints = 100;
  assert.equal(redeemFreeWash(customer), true);
  assert.equal(customer.loyaltyPoints, 0);
  assert.equal(redeemFreeWash(customer), false);
});
