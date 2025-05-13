/**
 * AgentMemoryManager.ts - Adapter implementation of MemoryManager for agents
 * 
 * This file provides an adapter implementation that bridges between the
 * MemoryManager interface and the agent's memory system.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  MemoryManager, 
  MemoryManagerConfig,
  MemoryEntry,
  MemorySearchOptions as BaseMemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../../../agents/base/managers/MemoryManager';
import { AbstractBaseManager } from '../../../agents/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { DefaultAgentMemory } from '../memory/DefaultAgentMemory';
import { MemoryType, ImportanceLevel, MemorySource } from '../../../../lib/constants/memory';
import { QdrantMemoryClient } from '../../../../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../../server/memory/services/client/embedding-service';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryEntry as SharedMemoryEntry, MemorySearchOptions } from '../../shared/memory/types';

/**
 * Error class for agent memory-related errors
 */
class MemoryError extends Error {
  code: string;
  context: Record<string, unknown>;

  constructor(message: string, code = 'MEMORY_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Adapter implementation of MemoryManager for agents
 */
export class AgentMemoryManager extends AbstractBaseManager {
  protected config: MemoryManagerConfig;
  protected initialized = false;
  private memory: DefaultAgentMemory | null = null;

  /**
   * Create a new AgentMemoryManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<MemoryManagerConfig> = {}) {
    const managerId = `agent-memory-manager-${uuidv4()}`;
    super(managerId, 'memory', agent, {
      enabled: config.enabled ?? true,
      enableAutoPruning: config.enableAutoPruning ?? true,
      pruningIntervalMs: config.pruningIntervalMs ?? 300000, // 5 minutes
      maxShortTermEntries: config.maxShortTermEntries ?? 100,
      relevanceThreshold: config.relevanceThreshold ?? 0.2,
      enableAutoConsolidation: config.enableAutoConsolidation ?? true,
      consolidationIntervalMs: config.consolidationIntervalMs ?? 600000, // 10 minutes
      minMemoriesForConsolidation: config.minMemoriesForConsolidation ?? 5,
      forgetSourceMemoriesAfterConsolidation: config.forgetSourceMemoriesAfterConsolidation ?? false,
      enableMemoryInjection: config.enableMemoryInjection ?? true,
      maxInjectedMemories: config.maxInjectedMemories ?? 5
    });
    this.config = {
      enabled: config.enabled ?? true,
      enableAutoPruning: config.enableAutoPruning ?? true,
      pruningIntervalMs: config.pruningIntervalMs ?? 300000,
      maxShortTermEntries: config.maxShortTermEntries ?? 100,
      relevanceThreshold: config.relevanceThreshold ?? 0.2,
      enableAutoConsolidation: config.enableAutoConsolidation ?? true,
      consolidationIntervalMs: config.consolidationIntervalMs ?? 600000,
      minMemoriesForConsolidation: config.minMemoriesForConsolidation ?? 5,
      forgetSourceMemoriesAfterConsolidation: config.forgetSourceMemoriesAfterConsolidation ?? false,
      enableMemoryInjection: config.enableMemoryInjection ?? true,
      maxInjectedMemories: config.maxInjectedMemories ?? 5
    };
  }

  /**
   * Get the manager type
   * Use managerType property to avoid infinite recursion
   * instead of calling this.getType() which would cause an infinite loop
   */
  getType(): string {
    // AbstractBaseManager uses managerType
    return this.managerType;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends MemoryManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends MemoryManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config
    };
    return this.config as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.getId()}] Initializing ${this.getType()} manager`);
    
    try {
      // Initialize memory system
      this.memory = new DefaultAgentMemory(this.getAgent().getAgentId());
      await this.memory.initialize();
      
      this.initialized = true;
      return true;
    } catch (error) {
      throw new MemoryError(
        'Failed to initialize memory system',
        'INITIALIZATION_FAILED',
        { error }
      );
    }
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.getId()}] Shutting down ${this.getType()} manager`);
    
    if (this.memory) {
      await this.memory.shutdown();
    }
    
    this.initialized = false;
  }

  /**
   * Check if the manager is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<void> {
    console.log(`[${this.getId()}] Resetting ${this.getType()} manager`);
    if (this.memory) {
      await this.memory.shutdown();
      this.memory = null;
    }
    this.initialized = false;
  }

  /**
   * Add a memory entry
   */
  async addMemory(memory: MemoryEntry): Promise<void> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    await this.memory.addMemory(
      memory.content,
      MemoryType.DOCUMENT,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      memory.metadata
    );
  }

  /**
   * Search for memories
   */
  async searchMemories(query: string, options?: BaseMemorySearchOptions): Promise<MemoryEntry[]> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const searchOptions: MemorySearchOptions = {
      limit: options?.limit,
      minScore: options?.minRelevance,
      type: options?.type === 'short-term' ? MemoryType.MESSAGE : 
            options?.type === 'long-term' ? MemoryType.DOCUMENT : undefined,
      metadata: options?.metadata
    };
    const results = await this.memory.search(query, searchOptions);
    return results.map(result => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      createdAt: result.createdAt,
      lastAccessedAt: result.lastAccessedAt,
      accessCount: result.accessCount
    }));
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<MemoryEntry[]> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const memories = await this.memory.getRecentlyModifiedMemories(limit);
    return memories.map(memory => ({
      id: memory.id,
      content: memory.content,
      metadata: memory.metadata,
      createdAt: memory.createdAt,
      lastAccessedAt: memory.lastAccessedAt,
      accessCount: memory.accessCount
    }));
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    await this.memory.consolidateMemories();
    return {
      success: true,
      consolidatedCount: 0, // TODO: Implement actual count
      message: 'Memories consolidated successfully'
    };
  }

  /**
   * Prune memories based on relevance and age
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    await this.memory.pruneMemories();
    return {
      success: true,
      prunedCount: 0, // TODO: Implement actual count
      message: 'Memories pruned successfully'
    };
  }

  /**
   * Get memory manager statistics
   */
  private async getStats(): Promise<{
    totalMemories: number;
    shortTermMemories: number;
    longTermMemories: number;
    memoryUsage: number;
    avgMemorySize: number;
    consolidationStats: {
      lastConsolidation: Date | null;
      totalConsolidated: number;
    };
    pruningStats: {
      lastPruning: Date | null;
      totalPruned: number;
    };
  }> {
    if (!this.memory) {
      throw new MemoryError(
        'Memory system not initialized',
        'NOT_INITIALIZED'
      );
    }

    const stats = await this.memory.getStats();
    
    return {
      totalMemories: stats.totalMemories,
      shortTermMemories: stats.shortTermMemories,
      longTermMemories: stats.longTermMemories,
      memoryUsage: stats.memoryUsageRatio,
      avgMemorySize: stats.averageMemorySize,
      consolidationStats: {
        lastConsolidation: stats.consolidationStats.lastConsolidation,
        totalConsolidated: stats.consolidationStats.memoriesConsolidated
      },
      pruningStats: {
        lastPruning: stats.pruningStats.lastPruning,
        totalPruned: stats.pruningStats.memoriesPruned
      }
    };
  }
} 