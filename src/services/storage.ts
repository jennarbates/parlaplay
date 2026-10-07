// Spec 7.3 and 9: a small key-value store over IndexedDB for the saved round and
// guest data. Storage is a nice-to-have, never a blocker: every read and write
// catches its own errors, so a full disk or a private window never stops play.
import { openDB, type IDBPDatabase } from "idb";

const dbName = "shei";
const storeName = "kv";

// Guest data lives under "guest" (spec 7.3), the round in progress under "round",
// and this device's settings (pinyin toggle, pronoun switch) under "settings". A signed-in user's local copy and outbox are kept per user, so signing
// out can clear exactly that user's data.
export type StorageKey = "guest" | "round" | "settings" | `user:${string}` | `outbox:${string}`;

let db: Promise<IDBPDatabase> | undefined;

function open(): Promise<IDBPDatabase> {
  db ??= openDB(dbName, 1, {
    upgrade(database) {
      database.createObjectStore(storeName);
    },
  });
  return db;
}

export async function read<T>(key: StorageKey): Promise<T | undefined> {
  try {
    return (await (await open()).get(storeName, key)) as T | undefined;
  } catch (error) {
    warn("read", key, error);
    return undefined;
  }
}

export async function write(key: StorageKey, value: unknown): Promise<boolean> {
  try {
    await (await open()).put(storeName, value, key);
    return true;
  } catch (error) {
    warn("write", key, error);
    return false;
  }
}

export async function remove(key: StorageKey): Promise<boolean> {
  try {
    await (await open()).delete(storeName, key);
    return true;
  } catch (error) {
    warn("remove", key, error);
    return false;
  }
}

// Ask the browser not to evict our data under storage pressure. Safari may still
// clear it after 7 days without a visit, which is why guests get a sign-in nudge.
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (error) {
    warn("persist", "guest", error);
    return false;
  }
}

function warn(op: string, key: string, error: unknown) {
  console.warn(`storage ${op} ${key} failed; playing on without it`, error);
}

// Tests only: forget the open connection so the next call opens a fresh one.
export function resetForTests() {
  db = undefined;
}
