import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
};

type VerifiedRecord = {
  phoneNumber: string;
  expiresAt: number;
};

type OtpState = {
  otps: Record<string, OtpRecord>;
  verified: Record<string, VerifiedRecord>;
};

const dataDir = path.join(process.cwd(), "data");
const otpPath = path.join(dataDir, "otp.json");
const otpTtlMs = 5 * 60 * 1000;
const verifiedTtlMs = 20 * 60 * 1000;

async function readOtpState(): Promise<OtpState> {
  await mkdir(dataDir, { recursive: true });
  try {
    const content = await readFile(otpPath, "utf8");
    const parsed = JSON.parse(content) as OtpState;
    return { otps: parsed.otps || {}, verified: parsed.verified || {} };
  } catch {
    return { otps: {}, verified: {} };
  }
}

async function writeOtpState(state: OtpState) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(otpPath, JSON.stringify(pruneExpired(state), null, 2), "utf8");
}

function pruneExpired(state: OtpState) {
  const now = Date.now();
  return {
    otps: Object.fromEntries(Object.entries(state.otps).filter(([, record]) => record.expiresAt >= now && record.attempts < 5)),
    verified: Object.fromEntries(Object.entries(state.verified).filter(([, record]) => record.expiresAt >= now))
  };
}

export async function createOtp(phoneNumber: string) {
  const state = await readOtpState();
  const code = String(randomInt(100000, 999999));
  state.otps[phoneNumber] = {
    code,
    expiresAt: Date.now() + otpTtlMs,
    attempts: 0
  };
  await writeOtpState(state);
  return code;
}

export async function verifyOtp(phoneNumber: string, code: string) {
  const state = await readOtpState();
  const record = state.otps[phoneNumber];
  if (!record || record.expiresAt < Date.now() || record.attempts >= 5) {
    delete state.otps[phoneNumber];
    await writeOtpState(state);
    return null;
  }

  record.attempts += 1;
  const left = Buffer.from(code);
  const right = Buffer.from(record.code);
  const valid = left.length === right.length && timingSafeEqual(left, right);
  await writeOtpState(state);
  if (!valid) return null;

  delete state.otps[phoneNumber];
  const token = randomBytes(24).toString("hex");
  state.verified[token] = {
    phoneNumber,
    expiresAt: Date.now() + verifiedTtlMs
  };
  await writeOtpState(state);
  return token;
}

export async function consumeOtpToken(phoneNumber: string, token?: string) {
  if (!token) return false;
  const state = await readOtpState();
  const record = state.verified[token];
  if (!record || record.expiresAt < Date.now() || record.phoneNumber !== phoneNumber) {
    delete state.verified[token];
    await writeOtpState(state);
    return false;
  }

  delete state.verified[token];
  await writeOtpState(state);
  return true;
}
