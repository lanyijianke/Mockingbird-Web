import type { CacheKeyPart, CacheLoadOptions, CachePolicy, CacheStore } from './types';

const KEY_DELIMITER = ':';
const DESCRIPTOR_DELIMITER = '\u0000';

function defaultIsEmptyValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.length === 0;
    return false;
}

export class CacheManager {
    private readonly tagIndex = new Map<string, Set<string>>();
    private readonly keyTagIndex = new Map<string, Set<string>>();

    constructor(private readonly store: CacheStore) {}

    async getOrLoad<T>(
        policy: CachePolicy,
        keyParts: readonly CacheKeyPart[],
        loader: () => Promise<T>,
        options?: CacheLoadOptions<T>,
    ): Promise<T> {
        const key = this.buildKey(keyParts);
        const cached = this.store.read<T>(policy.namespace, key);

        if (!options?.forceRefresh && cached && !cached.isExpired) {
            return cached.value;
        }

        try {
            const loaded = await loader();
            if ((loaded === null || loaded === undefined) && !options?.cacheNull) {
                return loaded;
            }

            const isEmpty = options?.isEmpty ?? defaultIsEmptyValue;
            if (policy.replaceOnEmptyResult === false && isEmpty(loaded)) {
                if (cached) return cached.value;
                return loaded;
            }

            this.store.write(policy.namespace, key, loaded, {
                ttlMs: policy.ttlMs,
                maxEntries: policy.maxEntries,
            });
            this.registerTags(policy.namespace, key, options?.tags ?? []);
            return loaded;
        } catch (error) {
            if (policy.allowStaleOnError && cached) {
                return cached.value;
            }
            throw error;
        }
    }

    invalidate(policy: CachePolicy, keyParts: readonly CacheKeyPart[]): void {
        const key = this.buildKey(keyParts);
        this.unregisterDescriptor(this.buildDescriptor(policy.namespace, key));
        this.store.delete(policy.namespace, key);
    }

    invalidateTag(tag: string): void {
        const descriptors = this.tagIndex.get(tag);
        if (!descriptors) return;

        for (const descriptor of [...descriptors]) {
            const { namespace, key } = this.parseDescriptor(descriptor);
            this.store.delete(namespace, key);
            this.unregisterDescriptor(descriptor);
        }
    }

    warm<T>(
        policy: CachePolicy,
        keyParts: readonly CacheKeyPart[],
        loader: () => Promise<T>,
        options?: Omit<CacheLoadOptions<T>, 'forceRefresh'>,
    ): Promise<T> {
        return this.getOrLoad(policy, keyParts, loader, {
            ...options,
            forceRefresh: true,
        });
    }

    clear(): void {
        this.store.clear();
        this.tagIndex.clear();
        this.keyTagIndex.clear();
    }

    buildKey(keyParts: readonly CacheKeyPart[]): string {
        return keyParts.map((part) => encodeURIComponent(String(part))).join(KEY_DELIMITER);
    }

    private registerTags(namespace: string, key: string, tags: readonly string[]): void {
        const descriptor = this.buildDescriptor(namespace, key);
        this.unregisterDescriptor(descriptor);

        if (tags.length === 0) return;

        const uniqueTags = new Set(tags);
        this.keyTagIndex.set(descriptor, uniqueTags);

        for (const tag of uniqueTags) {
            const descriptors = this.tagIndex.get(tag) ?? new Set<string>();
            descriptors.add(descriptor);
            this.tagIndex.set(tag, descriptors);
        }
    }

    private unregisterDescriptor(descriptor: string): void {
        const tags = this.keyTagIndex.get(descriptor);
        if (!tags) return;

        for (const tag of tags) {
            const descriptors = this.tagIndex.get(tag);
            if (!descriptors) continue;
            descriptors.delete(descriptor);
            if (descriptors.size === 0) {
                this.tagIndex.delete(tag);
            }
        }

        this.keyTagIndex.delete(descriptor);
    }

    private buildDescriptor(namespace: string, key: string): string {
        return `${namespace}${DESCRIPTOR_DELIMITER}${key}`;
    }

    private parseDescriptor(descriptor: string): { namespace: string; key: string } {
        const separatorIndex = descriptor.indexOf(DESCRIPTOR_DELIMITER);
        if (separatorIndex === -1) {
            return { namespace: descriptor, key: '' };
        }
        return {
            namespace: descriptor.slice(0, separatorIndex),
            key: descriptor.slice(separatorIndex + DESCRIPTOR_DELIMITER.length),
        };
    }
}
