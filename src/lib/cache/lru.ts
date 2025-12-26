type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

type LRUOptions = {
  maxSize: number;
  ttlMs: number;
};

export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly map = new Map<K, CacheEntry<V>>();

  constructor(options: LRUOptions) {
    this.maxSize = options.maxSize;
    this.ttlMs = options.ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  getEntry(key: K): CacheEntry<V> | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V, ttlMs?: number) {
    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, { value, expiresAt });
    this.evictIfNeeded();
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  private evictIfNeeded() {
    while (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey === undefined) return;
      this.map.delete(oldestKey);
    }
  }
}
