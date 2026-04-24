import type { CacheRecord, CacheStore, CacheWriteOptions } from './types';

interface StoredEntry<T> {
    value: T;
    expiresAt: number;
}

interface NamespaceBucket {
    entries: Map<string, StoredEntry<unknown>>;
    maxEntries?: number;
}

export class MemoryCacheStore implements CacheStore {
    private readonly namespaces = new Map<string, NamespaceBucket>();
    private sweepTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly sweepIntervalMs: number = 5 * 60 * 1000) {
        this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
        if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
            this.sweepTimer.unref();
        }
    }

    read<T>(namespace: string, key: string): CacheRecord<T> | null {
        const entry = this.namespaces.get(namespace)?.entries.get(key) as StoredEntry<T> | undefined;
        if (!entry) return null;

        return {
            value: entry.value,
            expiresAt: entry.expiresAt,
            isExpired: Date.now() >= entry.expiresAt,
        };
    }

    write<T>(namespace: string, key: string, value: T, options: CacheWriteOptions): void {
        const bucket = this.ensureBucket(namespace, options.maxEntries);
        bucket.maxEntries = options.maxEntries ?? bucket.maxEntries;

        this.sweepNamespace(bucket);

        if (bucket.entries.has(key)) {
            bucket.entries.delete(key);
        } else if (bucket.maxEntries && bucket.entries.size >= bucket.maxEntries) {
            const oldestKey = bucket.entries.keys().next().value;
            if (oldestKey !== undefined) {
                bucket.entries.delete(oldestKey);
            }
        }

        bucket.entries.set(key, {
            value,
            expiresAt: Date.now() + options.ttlMs,
        });
    }

    delete(namespace: string, key: string): void {
        const bucket = this.namespaces.get(namespace);
        if (!bucket) return;

        bucket.entries.delete(key);
        if (bucket.entries.size === 0) {
            this.namespaces.delete(namespace);
        }
    }

    deleteByPrefix(namespace: string, prefix: string = ''): void {
        const bucket = this.namespaces.get(namespace);
        if (!bucket) return;

        for (const key of bucket.entries.keys()) {
            if (!prefix || key.startsWith(prefix)) {
                bucket.entries.delete(key);
            }
        }

        if (bucket.entries.size === 0) {
            this.namespaces.delete(namespace);
        }
    }

    clear(namespace?: string): void {
        if (namespace) {
            this.namespaces.delete(namespace);
            return;
        }
        this.namespaces.clear();
    }

    dispose(): void {
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
        }
    }

    private ensureBucket(namespace: string, maxEntries?: number): NamespaceBucket {
        const existing = this.namespaces.get(namespace);
        if (existing) return existing;

        const bucket: NamespaceBucket = {
            entries: new Map<string, StoredEntry<unknown>>(),
            maxEntries,
        };
        this.namespaces.set(namespace, bucket);
        return bucket;
    }

    private sweep(): void {
        for (const [, bucket] of this.namespaces) {
            this.sweepNamespace(bucket);
        }
    }

    private sweepNamespace(bucket: NamespaceBucket): void {
        const now = Date.now();
        for (const [key, entry] of bucket.entries) {
            if (now >= entry.expiresAt) {
                bucket.entries.delete(key);
            }
        }
    }
}
