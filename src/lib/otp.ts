import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
};

type VerifiedRecord = {
  phoneNumber: string;
  expiresAt: number;
};

const otpStore = new Map<string, OtpRecord>();
const verifiedStore = new Map<string, VerifiedRecord>();
const otpTtlMs = 5 * 60 * 1000;
const verifiedTtlMs = 20 * 60 * 1000;

export function createOtp(phoneNumber: string) {
  const code = String(randomInt(100000, 999999));
  otpStore.set(phoneNumber, {
    code,
    expiresAt: Date.now() + otpTtlMs,
    attempts: 0
  });
  return code;
}

export function verifyOtp(phoneNumber: string, code: string) {
  const record = otpStore.get(phoneNumber);
  if (!record || record.expiresAt < Date.now() || record.attempts >= 5) {
    otpStore.delete(phoneNumber);
    return null;
  }

  record.attempts += 1;
  const left = Buffer.from(code);
  const right = Buffer.from(record.code);
  const valid = left.length === right.length && timingSafeEqual(left, right);
  if (!valid) return null;

  otpStore.delete(phoneNumber);
  const token = randomBytes(24).toString("hex");
  verifiedStore.set(token, {
    phoneNumber,
    expiresAt: Date.now() + verifiedTtlMs
  });
  return token;
}

export function consumeOtpToken(phoneNumber: string, token?: string) {
  if (!token) return false;
  const record = verifiedStore.get(token);
  if (!record || record.expiresAt < Date.now() || record.phoneNumber !== phoneNumber) {
    verifiedStore.delete(token);
    return false;
  }

  verifiedStore.delete(token);
  return true;
}
