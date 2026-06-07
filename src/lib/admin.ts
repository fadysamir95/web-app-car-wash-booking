import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, WORKER_SESSION_COOKIE } from "./constants";

const dataDir = path.join(process.cwd(), "data");
const adminSecurityPath = path.join(dataDir, "admin-security.json");
export const ADMIN_IDLE_TIMEOUT_SECONDS = 30 * 60;
const WORKER_SESSION_SECONDS = 8 * 60 * 60;

type AdminSecurity = {
  passwordHash?: string;
  updatedAt?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local or your deployment environment.`);
  }
  return value;
}

function sign(value: string, role: "admin" | "worker") {
  return createHmac("sha256", getRequiredEnv("ADMIN_SESSION_SECRET")).update(`${role}:${value}`).digest("hex");
}

export function createAdminToken() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt, "admin")}`;
}

export function createWorkerToken(workerId: string) {
  const issuedAt = String(Date.now());
  const value = `${workerId}:${issuedAt}`;
  return `${value}.${sign(value, "worker")}`;
}

function isValidToken(token: string | undefined, role: "admin" | "worker") {
  if (!token) return false;
  const [value, signature] = token.split(".");
  if (!value || !signature) return false;
  const issuedAt = role === "worker" ? value.split(":")[1] : value;
  const age = Date.now() - Number(issuedAt);
  const maxAge = role === "admin" ? ADMIN_IDLE_TIMEOUT_SECONDS * 1000 : WORKER_SESSION_SECONDS * 1000;
  if (!Number.isFinite(age) || age > maxAge) return false;

  const expected = sign(value, role);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isValidAdminToken(token?: string) {
  return isValidToken(token, "admin");
}

export function isValidWorkerToken(token?: string) {
  return isValidToken(token, "worker");
}

export function getWorkerIdFromToken(token?: string) {
  if (!isValidWorkerToken(token)) return null;
  return token?.split(".")[0]?.split(":")[0] || null;
}

export async function isAdminAuthenticated() {
  const jar = await cookies();
  return isValidAdminToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function getAdminSessionToken() {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return isValidAdminToken(token) ? token : null;
}

export function createAdminCsrfToken(sessionToken: string) {
  return createHmac("sha256", getRequiredEnv("ADMIN_SESSION_SECRET")).update(`csrf:${sessionToken}`).digest("hex");
}

export async function verifyAdminCsrf(request: Request) {
  const sessionToken = await getAdminSessionToken();
  const csrfToken = request.headers.get("x-csrf-token") || "";
  if (!sessionToken || !csrfToken) return false;
  const expected = createAdminCsrfToken(sessionToken);
  const left = Buffer.from(csrfToken);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isWorkerAuthenticated() {
  const jar = await cookies();
  return isValidWorkerToken(jar.get(WORKER_SESSION_COOKIE)?.value);
}

export async function getAuthenticatedWorkerId() {
  const jar = await cookies();
  return getWorkerIdFromToken(jar.get(WORKER_SESSION_COOKIE)?.value);
}

export async function verifyAdminPassword(password: string) {
  const security = await readAdminSecurity();
  if (security.passwordHash) return verifyPasswordHash(password, security.passwordHash);
  const expected = getRequiredEnv("ADMIN_PASSWORD");
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) return { ok: false as const, error: "Password must be at least 8 characters." };
  if (!(await verifyAdminPassword(currentPassword))) return { ok: false as const, error: "Current password is invalid." };
  await writeAdminSecurity({ passwordHash: hashPassword(newPassword), updatedAt: new Date().toISOString() });
  return { ok: true as const };
}

export function verifyWorkerPassword(password: string) {
  const expected = getRequiredEnv("WORKER_PASSWORD");
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readAdminSecurity(): Promise<AdminSecurity> {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(adminSecurityPath, "utf8")) as AdminSecurity;
  } catch {
    return {};
  }
}

async function writeAdminSecurity(security: AdminSecurity) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(adminSecurityPath, JSON.stringify(security, null, 2), "utf8");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
