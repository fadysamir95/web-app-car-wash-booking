import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const hiddenCarsPath = path.join(dataDir, "hidden-customer-cars.json");

type HiddenCarsState = Record<string, string[]>;

async function readHiddenCarsState(): Promise<HiddenCarsState> {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(hiddenCarsPath, "utf8")) as HiddenCarsState;
  } catch {
    return {};
  }
}

async function writeHiddenCarsState(state: HiddenCarsState) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(hiddenCarsPath, JSON.stringify(state, null, 2), "utf8");
}

export async function readHiddenCustomerCars(phoneNumber: string) {
  const state = await readHiddenCarsState();
  return state[phoneNumber] || [];
}

export async function hideCustomerCar(phoneNumber: string, carKey: string) {
  const state = await readHiddenCarsState();
  const current = new Set(state[phoneNumber] || []);
  current.add(carKey);
  state[phoneNumber] = [...current];
  await writeHiddenCarsState(state);
  return state[phoneNumber];
}
