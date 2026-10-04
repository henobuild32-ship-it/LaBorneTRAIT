export type OfflineRequest = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  createdAt: number;
};

const DB_NAME = 'gradeup-offline';
const STORE_NAME = 'outbox';
const CACHE_STORE_NAME = 'cache';
const DB_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CACHE_STORE_NAME)) {
        database.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineRequest(request: Omit<OfflineRequest, 'id' | 'createdAt'>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      ...request,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  window.dispatchEvent(new Event('gradeup-offline-queued'));
}

async function getQueuedRequests(): Promise<OfflineRequest[]> {
  if (typeof indexedDB === 'undefined') return [];
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      database.close();
      resolve((request.result as OfflineRequest[]).sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function removeQueuedRequest(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function flushOfflineQueue(): Promise<{ synced: number; pending: number }> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { synced: 0, pending: 0 };
  const queued = await getQueuedRequests();
  let synced = 0;

  for (const request of queued) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        }),
      });
      if (response.ok) {
        await removeQueuedRequest(request.id);
        synced++;
      } else if (response.status >= 400 && response.status < 500) {
        // Une requête refusée ne doit pas être rejouée indéfiniment.
        await removeQueuedRequest(request.id);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const remaining = await getQueuedRequests();
  return { synced, pending: remaining.length };
}

export async function queueOrFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response | null> {
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  if (init.method && init.method !== 'GET' && !headers['x-idempotency-key']) {
    headers['x-idempotency-key'] = crypto.randomUUID();
  }

  try {
    const response = await fetch(input, { ...init, headers });
    if (response.ok) return response;
    return response;
  } catch {
    const url = typeof input === 'string' ? input : input.toString();
    await enqueueOfflineRequest({
      url,
      method: init.method || 'GET',
      headers,
      body: typeof init.body === 'string' ? init.body : undefined,
    });
    return null;
  }
}

export async function cacheJson(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite');
    transaction.objectStore(CACHE_STORE_NAME).put({ key, value, cachedAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function readCachedJson<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(CACHE_STORE_NAME, 'readonly').objectStore(CACHE_STORE_NAME).get(key);
    request.onsuccess = () => {
      database.close();
      resolve(request.result?.value ?? null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

export async function fetchJsonWithCache<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as T;
    await cacheJson(url, data);
    return data;
  } catch {
    return (await readCachedJson<T>(url)) ?? fallback;
  }
}