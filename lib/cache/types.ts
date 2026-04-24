export type CacheKeyPart = string | number | boolean;

export interface CachePolicy {
    id: string;
    namespace: string;
    ttlMs: number;
    maxEntries?: number;
    allowStaleOnError?: boolean;
    replaceOnEmptyResult?: boolean;
    warmOnStartup?: boolean;
    pageRevalidateSeconds?: number;
    httpCacheControl?: string;
}

export interface CacheRecord<T> {
    value: T;
    expiresAt: number;
    isExpired: boolean;
}

export interface CacheWriteOptions {
    ttlMs: number;
    maxEntries?: number;
}

export interface CacheStore {
    read<T>(namespace: string, key: string): CacheRecord<T> | null;
    write<T>(namespace: string, key: string, value: T, options: CacheWriteOptions): void;
    delete(namespace: string, key: string): void;
    deleteByPrefix(namespace: string, prefix?: string): void;
    clear(namespace?: string): void;
    dispose?(): void;
}

export interface CacheLoadOptions<T> {
    cacheNull?: boolean;
    forceRefresh?: boolean;
    isEmpty?: (value: T) => boolean;
    tags?: string[];
}
