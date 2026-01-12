// src/lib/cache/softCache.ts
//
// Stage 3.7 — Reddit resilience (soft cache, no drift)
//
// Purpose:
// - Provide a tiny in-memory "soft cache" for API routes.
// - Support deterministic "last known-good" fallback when upstream fails.
// - Never mutate returned payloads (so cached responses don't drift).
//
// Notes:
// - This is an in-process memory cache (per server instance).
// - On Vercel/serverless it may be cold-started or not shared across regions.
//   That's OK: the goal is resilience and no drift when we do have a cache.
// - Keep this generic: can be reused for other signal sources later.
//
// Usage:
//   const cache = getSoftCache<MyType>({ namespace: "reddit", ttlMs: ..., maxStaleMs: ... });
//   const hit = cache.get(key);
//   cache.set(key, data);
//   cache.clear(key) / cache.clearAll()
//
// Contract:
// - get() returns either { data, meta } or null
// - set() stores a deep-frozen snapshot (best-effort) to prevent accidental drift
// - meta tells you age, stale status, and timings for debug surfaces

export type SoftCacheMeta = {
  key: string;
  namespace: string;

  // When the cached value was stored (ms since epoch)
  savedAt: number;

  // Age in milliseconds at the time of read
  ageMs: number;

  // TTL applied to "freshness"
  ttlMs: number;

  // Max stale window allowed for fallback
  maxStaleMs: number;

  // Derived flags
  isFresh: boolean;
  isStale: boolean; // within stale window but beyond ttl
  isExpired: boolean; // beyond maxStaleMs

  // Helpful debug info
  now: number;
};

type SoftCacheEntry<T> = {
  data: T;
  savedAt: number;
};

type SoftCacheOptions = {
  // Logical cache partition to avoid key collisions across features
  namespace: string;

  // Freshness window (ms). Within this, isFresh=true.
  ttlMs: number;

  // Maximum stale window (ms). Beyond this, entry is expired and not returned.
  maxStaleMs: number;

  // Optional cap to limit memory growth per namespace (best-effort)
  maxEntries?: number;
};

// Default policy if caller doesn't want to think.
// Keep conservative: small TTL, reasonable stale fallback.
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_ENTRIES = 200;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

// Global cache store (per Node process)
const STORE: Map<string, Map<string, SoftCacheEntry<unknown>>> = new Map();

/**
 * Best-effort deep freeze to prevent accidental mutations that would cause drift.
 * - Freezing is shallow by default; we recurse on objects/arrays.
 * - If freezing fails (rare), we still store the value.
 */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  // Primitives/functions/etc.
  if (value === null || typeof value !== "object") return value;

  const obj = value as unknown as object;
  if (seen.has(obj)) return value;
  seen.add(obj);

  try {
    // Freeze children first
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item, seen);
    } else if (isObject(value)) {
      // Only iterate own enumerable properties
      for (const key of Object.keys(value)) {
        deepFreeze(value[key], seen);
      }
    }

    Object.freeze(obj);
  } catch {
    // Ignore — this is best effort
  }

  return value;
}

/**
 * Ensure a namespace map exists and return it.
 */
function getNamespaceMap(namespace: string): Map<string, SoftCacheEntry<unknown>> {
  const ns = namespace.trim();
  if (!STORE.has(ns)) STORE.set(ns, new Map());
  const map = STORE.get(ns);
  if (!map) {
    // Extremely defensive; should never happen.
    const created = new Map<string, SoftCacheEntry<unknown>>();
    STORE.set(ns, created);
    return created;
  }
  return map;
}

/**
 * Evict oldest entries if we exceed the maxEntries cap (best-effort, O(n)).
 */
function enforceCap<T>(map: Map<string, SoftCacheEntry<T>>, maxEntries: number) {
  if (map.size <= maxEntries) return;

  // Find oldest entries by savedAt
  const entries = Array.from(map.entries());
  entries.sort((a, b) => a[1].savedAt - b[1].savedAt); // oldest first

  const toRemove = map.size - maxEntries;
  for (let i = 0; i < toRemove; i++) {
    const pair = entries[i];
    if (!pair) continue;
    const [key] = pair;
    map.delete(key);
  }
}

/**
 * Public API: get a typed soft cache for a namespace.
 */
export function getSoftCache<T>(options: Partial<SoftCacheOptions> & { namespace: string }) {
  const namespace = options.namespace;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  if (!namespace || namespace.trim().length === 0) {
    throw new Error("[softCache] namespace is required");
  }
  if (ttlMs <= 0) {
    throw new Error("[softCache] ttlMs must be > 0");
  }
  if (maxStaleMs < ttlMs) {
    throw new Error("[softCache] maxStaleMs must be >= ttlMs");
  }

  const map = getNamespaceMap(namespace) as Map<string, SoftCacheEntry<T>>;

  return {
    /**
     * Read a cache entry by key.
     * Returns null if missing or expired (beyond maxStaleMs).
     */
    get(key: string): { data: T; meta: SoftCacheMeta } | null {
      const k = key.trim();
      if (!k) return null;

      const entry = map.get(k);
      if (!entry) return null;

      const now = Date.now();
      const ageMs = now - entry.savedAt;

      const isFresh = ageMs <= ttlMs;
      const isExpired = ageMs > maxStaleMs;
      const isStale = !isFresh && !isExpired;

      if (isExpired) {
        // prune expired
        map.delete(k);
        return null;
      }

      const meta: SoftCacheMeta = {
        key: k,
        namespace,
        savedAt: entry.savedAt,
        ageMs,
        ttlMs,
        maxStaleMs,
        isFresh,
        isStale,
        isExpired,
        now,
      };

      return { data: entry.data, meta };
    },

    /**
     * Write/overwrite cache entry by key.
     * Stores a deep-frozen snapshot to prevent accidental mutation drift.
     */
    set(key: string, data: T): void {
      const k = key.trim();
      if (!k) return;

      const savedAt = Date.now();

      // Freeze to prevent mutations (best-effort).
      // NOTE: we freeze the provided object reference; callers should treat `data`
      // as immutable after calling set(). If you want absolute immutability,
      // pass a structuredClone(data) from the caller first.
      const frozen = deepFreeze(data);

      map.set(k, { data: frozen, savedAt });

      // Cap size (best-effort)
      enforceCap(map, maxEntries);
    },

    /**
     * Remove a specific key.
     */
    clear(key: string): void {
      const k = key.trim();
      if (!k) return;
      map.delete(k);
    },

    /**
     * Clear all entries in this namespace.
     */
    clearAll(): void {
      map.clear();
    },

    /**
     * Optional: quick stats for debugging.
     */
    stats(): {
      namespace: string;
      size: number;
      ttlMs: number;
      maxStaleMs: number;
      maxEntries: number;
    } {
      return { namespace, size: map.size, ttlMs, maxStaleMs, maxEntries };
    },
  };
}

/**
 * Convenience: stable key helper.
 * Ensures you don't accidentally create different keys for the same logical request.
 *
 * Example:
 *   const key = makeCacheKey("reddit", { subs: ["marketing","socialmedia"], limit: 10 })
 */
export function makeCacheKey(
  namespace: string,
  parts: Record<string, string | number | boolean | Array<string | number>>
) {
  const ns = namespace.trim();

  const entries = Object.entries(parts).map(([k, v]) => {
    if (Array.isArray(v)) {
      // stringify arrays deterministically
      const arr = v
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
        .sort();
      return `${k}=${arr.join(",")}`;
    }
    return `${k}=${String(v).trim().toLowerCase()}`;
  });

  // sort keys deterministically
  entries.sort();

  return `${ns}:${entries.join("&")}`;
}
