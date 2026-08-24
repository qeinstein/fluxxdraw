/** Tiny promise wrapper over a single-store IndexedDB database. */

const DB_NAME = "fluxxdraw";
const STORE = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbGet = <T>(key: string) =>
  withStore<T | undefined>("readonly", (store) => store.get(key) as IDBRequest<T | undefined>);

export const idbSet = (key: string, value: unknown) =>
  withStore("readwrite", (store) => store.put(value, key) as IDBRequest<IDBValidKey>);

export const idbDelete = (key: string) =>
  withStore("readwrite", (store) => store.delete(key) as unknown as IDBRequest<undefined>);
