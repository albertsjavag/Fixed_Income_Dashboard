// Simple in-memory cache with TTL (1 hour)
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const store = new Map<string, CacheEntry>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  store.set(key, { data, timestamp: Date.now() });
}
