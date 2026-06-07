import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SERVICE_AREAS } from "./constants";
import type { PublicWorker, Worker } from "./types";

const dataDir = path.join(process.cwd(), "data");
const workersPath = path.join(dataDir, "workers.json");

async function ensureWorkersFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(workersPath, "utf8");
  } catch {
    await writeFile(workersPath, JSON.stringify([defaultWorker()], null, 2), "utf8");
  }
}

export async function readWorkers(): Promise<Worker[]> {
  await ensureWorkersFile();
  try {
    const content = await readFile(workersPath, "utf8");
    const workers = JSON.parse(content) as Worker[];
    let changed = false;
    const migrated = workers.map((worker) => {
      if (worker.id === "worker_default" && !worker.passwordPreview) {
        changed = true;
        return { ...worker, passwordPreview: process.env.WORKER_PASSWORD || "worker12345" };
      }
      return worker;
    });
    if (changed) await writeWorkers(migrated);
    return migrated;
  } catch {
    return [defaultWorker()];
  }
}

async function writeWorkers(workers: Worker[]) {
  await ensureWorkersFile();
  await writeFile(workersPath, JSON.stringify(workers, null, 2), "utf8");
}

export function publicWorker(worker: Worker): PublicWorker {
  const safeWorker = { ...worker };
  delete (safeWorker as Partial<Worker>).passwordHash;
  return safeWorker;
}

export async function createWorker(input: { name: string; password: string; areas: string[] }) {
  const workers = await readWorkers();
  const worker: Worker = {
    id: `worker_${randomBytes(3).toString("hex")}`,
    name: input.name.trim(),
    passwordHash: hashPassword(input.password),
    passwordPreview: input.password,
    areas: input.areas,
    completedWashes: 0,
    createdAt: new Date().toISOString()
  };
  await writeWorkers([worker, ...workers]);
  return publicWorker(worker);
}

export async function updateWorker(id: string, input: { name?: string; password?: string; areas?: string[] }) {
  const workers = await readWorkers();
  const worker = workers.find((item) => item.id === id);
  if (!worker) return null;
  if (input.name) worker.name = input.name.trim();
  if (input.password) {
    worker.passwordHash = hashPassword(input.password);
    worker.passwordPreview = input.password;
  }
  if (input.areas) worker.areas = input.areas;
  await writeWorkers(workers);
  return publicWorker(worker);
}

export async function deleteWorker(id: string) {
  const workers = await readWorkers();
  const remaining = workers.filter((worker) => worker.id !== id);
  if (remaining.length === workers.length) return null;
  await writeWorkers(remaining);
  return remaining.map(publicWorker);
}

export async function findWorkerByPassword(password: string) {
  const workers = await readWorkers();
  return workers.find((worker) => verifyPassword(password, worker.passwordHash)) || null;
}

export async function getWorkerById(id: string) {
  const workers = await readWorkers();
  return workers.find((worker) => worker.id === id) || null;
}

export async function recordWorkerWash(id: string) {
  const workers = await readWorkers();
  const worker = workers.find((item) => item.id === id);
  if (!worker) return null;
  worker.completedWashes += 1;
  worker.lastActivityAt = new Date().toISOString();
  await writeWorkers(workers);
  return publicWorker(worker);
}

export async function updateWorkerLocation(id: string, latitude: number, longitude: number) {
  const workers = await readWorkers();
  const worker = workers.find((item) => item.id === id);
  if (!worker) return null;
  worker.currentLat = latitude;
  worker.currentLng = longitude;
  worker.currentLocationUpdatedAt = new Date().toISOString();
  worker.lastActivityAt = worker.currentLocationUpdatedAt;
  await writeWorkers(workers);
  return publicWorker(worker);
}

function defaultWorker(): Worker {
  return {
    id: "worker_default",
    name: "Default Worker",
    passwordHash: hashPassword(process.env.WORKER_PASSWORD || "worker12345"),
    passwordPreview: process.env.WORKER_PASSWORD || "worker12345",
    areas: SERVICE_AREAS.map((area) => area.id),
    completedWashes: 0,
    createdAt: new Date().toISOString()
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
