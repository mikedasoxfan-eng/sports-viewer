/**
 * Generic TTL cache with stale-while-revalidate.
 */

export function createCache(ttlMs, staleTtlMs = null) {
  const entries = new Map();
  const staleMs = staleTtlMs || ttlMs * 10;

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      const age = Date.now() - entry.ts;
      if (age <= ttlMs) return { data: entry.data, stale: false, age };
      if (age <= staleMs) return { data: entry.data, stale: true, age };
      entries.delete(key);
      return null;
    },

    set(key, data) {
      entries.set(key, { data, ts: Date.now() });
    },

    has(key) {
      return this.get(key) !== null;
    },

    clear() {
      entries.clear();
    }
  };
}
