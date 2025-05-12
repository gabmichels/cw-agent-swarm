/**
 * CacheManager implementation for memory system
 */

import { MemoryType } from '../../config/types';
import { BaseMemorySchema } from '../../models';

interface CacheOptions {
  maxSize: number;
  ttl: number;
  getTimestamp?: () => number;
}

interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl?: number;
  lastAccessed: number;
}

interface CacheStorage {
  get<T>(key: string): Promise<CacheItem<T> | null>;
  set<T>(key: string, item: CacheItem<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;
  getAllKeys(): Promise<string[]>;
}

class InMemoryStorage implements CacheStorage {
  private storage: Map<string, CacheItem<unknown>> = new Map();
  private getTimestamp: () => number;

  constructor(getTimestamp: () => number) {
    this.getTimestamp = getTimestamp;
  }

  async get<T>(key: string): Promise<CacheItem<T> | null> {
    const item = this.storage.get(key) as CacheItem<T> | undefined;
    if (!item) return null;
    return item;
  }

  async set<T>(key: string, item: CacheItem<T>): Promise<void> {
    this.storage.set(key, item as CacheItem<unknown>);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async getSize(): Promise<number> {
    return this.storage.size;
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

export class CacheManager {
  private storage: CacheStorage;
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions) {
    this.options = {
      ...options,
      getTimestamp: options.getTimestamp || (() => Date.now())
    };
    this.storage = new InMemoryStorage(this.options.getTimestamp);
  }

  async get<T extends BaseMemorySchema>(key: string): Promise<T | null> {
    if (!key) throw new Error('Invalid key');

    const item = await this.storage.get<T>(key);
    if (!item) return null;

    // Check if item has expired
    const now = this.options.getTimestamp();
    if (item.ttl && now - item.timestamp > item.ttl) {
      await this.storage.delete(key);
      return null;
    }

    // Update lastAccessed only on real access
    item.lastAccessed = now;
    await this.storage.set(key, item);

    return item.value;
  }

  async set<T extends BaseMemorySchema>(
    key: string, 
    value: T, 
    options: { ttl?: number } = {}
  ): Promise<void> {
    if (!key) throw new Error('Invalid key');
    if (!value) throw new Error('Invalid value');

    // Check if we need to evict items
    const size = await this.storage.getSize();
    if (size >= this.options.maxSize) {
      await this.evictItems();
    }

    const now = this.options.getTimestamp();
    const item: CacheItem<T> = {
      value,
      timestamp: now,
      ttl: options.ttl || this.options.ttl,
      lastAccessed: now
    };

    await this.storage.set(key, item);
  }

  async delete(key: string): Promise<void> {
    if (!key) throw new Error('Invalid key');
    await this.storage.delete(key);
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }

  async getSize(): Promise<number> {
    return this.storage.getSize();
  }

  async cleanup(): Promise<void> {
    const now = this.options.getTimestamp();
    const keys = await this.storage.getAllKeys();

    for (const key of keys) {
      const item = await this.storage.get(key);
      if (item && item.ttl && now - item.timestamp > item.ttl) {
        await this.storage.delete(key);
      }
    }
  }

  private async evictItems(): Promise<void> {
    const keys = await this.storage.getAllKeys();
    if (keys.length === 0) return;

    // Sort by last accessed time
    const items = await Promise.all(
      keys.map(async (key) => {
        const item = await this.storage.get(key);
        return { key, lastAccessed: item?.lastAccessed || 0 };
      })
    );

    items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Evict only the single least recently used item
    await this.storage.delete(items[0].key);
  }
} 