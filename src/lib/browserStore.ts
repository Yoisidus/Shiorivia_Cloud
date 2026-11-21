"use client";

/** Origin-scoped browser persistence. IndexedDB quotas vary by browser/usage. */
const DB_NAME = "shiorivia-cloud-v1";
const STORE = "records";
const VERSION = 1;
const CHANGE_EVENT = "shiorivia-cloud-storage-change";
const CHANNEL = "shiorivia-cloud-storage-updates";
let dbPromise: Promise<IDBDatabase> | null = null;
let changesChannel: BroadcastChannel | null = null;

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!changesChannel) {
    try { changesChannel = new BroadcastChannel(CHANNEL); }
    catch { return null; }
  }
  return changesChannel;
}

function signalChange(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
  }
  try { channel()?.postMessage(key); } catch { /* Notifications are best effort. */ }
}

/** Listen for same-tab and cross-tab committed writes, never unsaved drafts. */
export function subscribeBrowserChanges(prefix: string, callback: (key: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const local = (event: Event) => {
    const key = (event as CustomEvent<unknown>).detail;
    if (typeof key === "string" && key.startsWith(prefix)) callback(key);
  };
  const remote = (event: MessageEvent<unknown>) => {
    if (typeof event.data === "string" && event.data.startsWith(prefix)) callback(event.data);
  };
  window.addEventListener(CHANGE_EVENT, local);
  const broadcast = channel();
  broadcast?.addEventListener("message", remote);
  return () => {
    window.removeEventListener(CHANGE_EVENT, local);
    broadcast?.removeEventListener("message", remote);
  };
}

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          dbPromise = null;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Unable to open browser storage."));
      request.onblocked = () => reject(new Error("Close other Shiorivia tabs to upgrade storage."));
    }).catch(error => { dbPromise = null; throw error; });
  }
  return dbPromise!;
}

export async function browserRead<T>(key: string, fallback: T): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result as T);
    req.onerror = () => reject(req.error || new Error("Browser storage read failed."));
    tx.onerror = () => reject(tx.error || new Error("Browser storage transaction failed."));
  });
}

/**
 * Atomic read/validate/write in ONE IndexedDB readwrite transaction.
 * Updaters must be synchronous. Other tabs' readwrite transactions on this
 * object store serialize; validation cannot race a competing project write.
 */
export async function browserMutate<T>(key: string, updater: (current: T | undefined) => T): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    let next: T | undefined;
    let changed = false;
    let validationError: unknown;
    req.onsuccess = () => {
      try {
        const current = req.result as T | undefined;
        next = updater(current);
        if (next !== current) {
          changed = true;
          store.put(next, key);
        }
      } catch (error) {
        validationError = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      if (changed) signalChange(key);
      resolve(next as T);
    };
    tx.onabort = () => reject(validationError || tx.error || new Error("Browser storage write was cancelled or quota exceeded."));
    tx.onerror = () => { /* onabort reports the final transaction failure. */ };
  });
}

/** Discover actual persisted projects instead of racing a separate index key. */
export async function browserKeys(prefix: string): Promise<string[]> {
  const db = await database();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const keys: string[] = [];
    const req = tx.objectStore(STORE).openKeyCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) keys.push(cursor.key);
      cursor.continue();
    };
    tx.oncomplete = () => resolve(keys);
    tx.onerror = () => reject(tx.error || new Error("Unable to list browser projects."));
    tx.onabort = () => reject(tx.error || new Error("Unable to list browser projects."));
  });
}

export async function browserWrite<T>(key: string, value: T): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { signalChange(key); resolve(); };
    tx.onerror = () => reject(tx.error || new Error("Browser storage write failed. Check your browser quota."));
    tx.onabort = () => reject(tx.error || new Error("Browser storage write was cancelled."));
  });
}

export async function browserDelete(key: string): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { signalChange(key); resolve(); };
    tx.onerror = () => reject(tx.error || new Error("Browser storage delete failed."));
    tx.onabort = () => reject(tx.error || new Error("Browser storage delete was cancelled."));
  });
}
