type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = Number(process.env.CACHE_TTL ?? 300) * 1000;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL): T {
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) if (v.expires < now) store.delete(k);
  }
  return value;
}

/**
 * Cache + dedupe: permintaan paralel untuk key yang sama hanya menembak sumber sekali.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = fn()
    .then((value) => {
      cacheSet(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}
