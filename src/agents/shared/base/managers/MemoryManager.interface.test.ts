/**
 * MemoryManager.interface.test.ts - Tests for the MemoryManager interface
 * 
 * This file contains tests to ensure the MemoryManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  MemoryManager, 
  MemoryManagerConfig, 
  MemoryEntry, 
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from './MemoryManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

// Mock implementation of the MemoryManager interface for testing
class MockMemoryManager extends AbstractBaseManager implements MemoryManager {
  private memories: Map<string, MemoryEntry> = new Map();

  constructor() {
    super('mock-memory-manager', ManagerType.MEMORY, {} as AgentBase, { enabled: true });
  }

  async initialize(): Promise<boolean> {
    this._initialized = true;
    return true;
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
  }

  async getHealth(): Promise<ManagerHealth> {
    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          memoryCount: this.memories.size
        }
      }
    };
  }

  async addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry> {
    const memory: MemoryEntry = {
      id: `mem-${Date.now()}`,
      content,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
      metadata
    };
    this.memories.set(memory.id, memory);
    return memory;
  }

  async searchMemories(query: string, options: MemorySearchOptions): Promise<MemoryEntry[]> {
    // Simple mock implementation that returns all memories containing the query string
    return Array.from(this.memories.values())
      .filter(memory => memory.content.toLowerCase().includes(query.toLowerCase()));
  }

  async getRecentMemories(limit: number): Promise<MemoryEntry[]> {
    return Array.from(this.memories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    return {
      success: true,
      consolidatedCount: 0,
      message: 'No memories to consolidate'
    };
  }

  async pruneMemories(): Promise<MemoryPruningResult> {
    return {
      success: true,
      prunedCount: 0,
      message: 'No memories to prune'
    };
  }
}

describe('MemoryManager Interface', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MockMemoryManager();
  });

  it('should implement BaseManager interface', () => {
    // Type check that MemoryManager extends BaseManager
    const manager: BaseManager = memoryManager;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(memoryManager.managerType).toBe(ManagerType.MEMORY);
  });

  it('should initialize successfully', async () => {
    const result = await memoryManager.initialize();
    expect(result).toBe(true);
    expect(memoryManager.isEnabled()).toBe(true);
  });

  it('should add and retrieve memories', async () => {
    const memory = await memoryManager.addMemory('test memory', { type: 'test' });
    expect(memory).toHaveProperty('id');
    expect(memory.content).toBe('test memory');

    const recentMemories = await memoryManager.getRecentMemories(1);
    expect(recentMemories).toHaveLength(1);
    expect(recentMemories[0].id).toBe(memory.id);
  });

  it('should search memories', async () => {
    await memoryManager.addMemory('test memory one', { type: 'test' });
    await memoryManager.addMemory('test memory two', { type: 'test' });
    await memoryManager.addMemory('different memory', { type: 'test' });

    const results = await memoryManager.searchMemories('test memory');
    expect(results).toHaveLength(2);
  });

  it('should consolidate memories', async () => {
    const result = await memoryManager.consolidateMemories();
    expect(result.success).toBe(true);
  });

  it('should prune memories', async () => {
    const result = await memoryManager.pruneMemories();
    expect(result.success).toBe(true);
  });
}); 