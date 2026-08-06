import { get, set, del, keys, clear } from 'idb-keyval';

export interface CacheEnvelope<T = any> {
  data: T;
  timestamp: number;
  ttl?: number; // TTL in milliseconds
}

/**
 * SafeCache - Resilient IndexedDB cache with TTL and fail-safe error handling.
 * Prevents QuotaExceeded errors and browser warnings.
 */
export const safeCache = {
  /**
   * Retrieves an item from IndexedDB cache.
   * If the item is missing or expired, it automatically cleans it up and returns null.
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const envelope = await get<CacheEnvelope<T>>(key);
      if (!envelope || envelope.data === undefined) {
        return null;
      }

      // Check TTL expiration
      if (envelope.ttl && envelope.ttl > 0) {
        const isExpired = Date.now() - envelope.timestamp > envelope.ttl;
        if (isExpired) {
          // Asynchronously purge expired entry
          del(key).catch(() => {});
          return null;
        }
      }

      return envelope.data;
    } catch (error) {
      // Fail-safe: if IndexedDB read fails (Incognito mode, permission error, etc), log warning silently and return null to trigger fresh fetch
      console.warn(`[SafeCache] Read failed for key "${key}", falling back to fresh fetch.`, error);
      return null;
    }
  },

  /**
   * Sets an item in IndexedDB cache with optional TTL (defaulting to 30 minutes if not specified).
   */
  async set<T = any>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): Promise<boolean> {
    try {
      const envelope: CacheEnvelope<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };
      await set(key, envelope);
      return true;
    } catch (error) {
      // Fail-safe: silently catch write errors so UI is never interrupted
      console.warn(`[SafeCache] Write failed for key "${key}". Continuing without cache.`, error);
      return false;
    }
  },

  /**
   * Removes a specific item from IndexedDB cache.
   */
  async remove(key: string): Promise<void> {
    try {
      await del(key);
    } catch (error) {
      console.warn(`[SafeCache] Remove failed for key "${key}".`, error);
    }
  },

  /**
   * Clears all keys matching a given prefix from IndexedDB cache.
   */
  async clearByPrefix(prefix: string): Promise<void> {
    try {
      const allKeys = await keys();
      const targets = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));
      await Promise.all(targets.map((k) => del(k).catch(() => {})));
    } catch (error) {
      console.warn(`[SafeCache] Clear by prefix failed for "${prefix}".`, error);
    }
  },

  /**
   * Clears all entries from IndexedDB cache.
   */
  async clearAll(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      console.warn('[SafeCache] Clear all failed.', error);
    }
  },

  /**
   * Silently purges old legacy heavy data from localStorage to reclaim browser storage quota.
   */
  purgeLegacyLocalStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('app_cache_v2_') ||
            k.startsWith('pscqube_op_cache_') ||
            k.startsWith('pscqube_maestros_cache'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      if (keysToRemove.length > 0) {
        console.log(`[SafeCache] Successfully purged ${keysToRemove.length} legacy entries from localStorage.`);
      }
    } catch (error) {
      // Silently ignore
    }
  },
};

// Automatically run legacy cleanup on module load
safeCache.purgeLegacyLocalStorage();
