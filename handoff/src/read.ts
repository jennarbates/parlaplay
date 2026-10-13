// Read-only access to Chi è?'s IndexedDB, "chi-e", store "kv" (its
// src/services/storage.ts at chie-launch). Nothing here writes or deletes, so Try
// again on parlaplay.games always finds the data still here (platform spec 5.3).
const dbName = "chi-e";
const storeName = "kv";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

// Every key and value Chi è? saved, or an empty map on a device that never played
// (or whose storage cannot be read).
export async function readChie(): Promise<Map<string, unknown>> {
  const kv = new Map<string, unknown>();
  try {
    const open = indexedDB.open(dbName);
    // No database yet: opening would create one. Abort instead, so a device that
    // never played Chi è? is left exactly as it was.
    open.onupgradeneeded = () => open.transaction?.abort();
    const db = await request(open);
    try {
      if (!db.objectStoreNames.contains(storeName)) return kv;
      const store = db.transaction(storeName, "readonly").objectStore(storeName);
      const [keys, values] = await Promise.all([
        request(store.getAllKeys()),
        request(store.getAll()),
      ]);
      keys.forEach((key, i) => kv.set(String(key), values[i]));
    } finally {
      db.close();
    }
  } catch {
    // Private mode, blocked storage, or the aborted open above.
  }
  return kv;
}
