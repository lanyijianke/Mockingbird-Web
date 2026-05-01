import { CacheManager } from './manager';
import { MemoryCacheStore } from './memory-store';

let store = new MemoryCacheStore();
let manager = new CacheManager(store);

export function getCacheManager(): CacheManager {
    return manager;
}
