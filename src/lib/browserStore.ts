"use client";

/** Origin-scoped browser persistence. IndexedDB quotas vary by browser/usage. */
const DB_NAME = "shiorivia-cloud-v1";
const STORE = "records";
const VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open browser storage."));
      request.onblocked = () => reject(new Error("Close other Shiorivia tabs to upgrade storage."));
    }).catch(error => { dbPromise = null; throw error; });
  }
  return dbPromise;
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

export async function browserWrite<T>(key: string, value: T): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Browser storage write failed. Check your browser quota."));
    tx.onabort = () => reject(tx.error || new Error("Browser storage write was cancelled."));
  });
}

export async function browserDelete(key: string): Promise<void> {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Browser storage delete failed."));
  });
}
