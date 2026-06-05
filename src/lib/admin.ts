import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "./constants";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local or your deployment environment.`);
  }
  return value;
}

function sign(value: string) {
  return createHmac("sha256", getRequiredEnv("ADMIN_SESSION_SECRET")).update(value).digest("hex");
}

export function createAdminToken() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function isValidAdminToken(token?: string) {
  if (!token) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age > 1000 * 60 * 60 * 8) return false;

  const expected = sign(issuedAt);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isAdminAuthenticated() {
  const jar = await cookies();
  return isValidAdminToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

export function verifyAdminPassword(password: string) {
  const expected = getRequiredEnv("ADMIN_PASSWORD");
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
