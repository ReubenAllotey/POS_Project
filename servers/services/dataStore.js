import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../../data/store.json");

const defaultStore = {
  meta: {
    nextIds: {
      users: 1,
      products: 1,
      customers: 1,
      sales: 1,
    },
  },
  users: [],
  products: [],
  customers: [],
  sales: [],
};

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

export async function ensureStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultStore, null, 2));
  }
}

export async function readStore() {
  await ensureStore();
  const fileContents = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(fileContents);

  parsed.meta ??= {};
  parsed.meta.nextIds ??= {};
  parsed.users ??= [];
  parsed.products ??= [];
  parsed.customers ??= [];
  parsed.sales ??= [];

  return parsed;
}

export async function writeStore(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function updateStore(updater) {
  const current = await readStore();
  const draft = clone(current);
  const result = await updater(draft);
  await writeStore(draft);
  return result;
}

export function takeNextId(store, collectionName) {
  const nextIds = (store.meta.nextIds ??= {});
  const currentValue = Number(nextIds[collectionName] ?? 1);
  nextIds[collectionName] = currentValue + 1;
  return currentValue;
}
