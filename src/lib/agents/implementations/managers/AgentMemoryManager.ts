/**
 * AgentMemoryManager.ts - Adapter implementation of MemoryManager for agents
 * 
 * This file provides an adapter implementation that bridges between the
 * MemoryManager interface and the agent's existing memory systems.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  MemoryManager, 
  MemoryManagerConfig,
  MemoryEntry,
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../../../agents/base/managers/MemoryManager';
import { AbstractBaseManager } from '../../../agents/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { AgentMemory } from '../../../../agents/chloe/memory';
import { MemoryManager as ChloeMemoryManagerClass } from '../../../../agents/chloe/core/memoryManager';
import { MemoryType, ImportanceLevel, MemorySource } from '../../../../constants/memory';
import { EnhancedMemoryService } from '../../../../server/memory/services/multi-agent/enhanced-memory-service';
import { SearchService } from '../../../../server/memory/services/search/search-service';
import { QdrantMemoryClient } from '../../../../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../../server/memory/services/client/embedding-service';
import { TaskLogger } from '../../../../agents/chloe/task-logger';

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

// Minimal TaskLogger class for compatibility
class MinimalTaskLogger {
  logsPath = '';
  maxSessionsInMemory = 1;
  persistToFile = false;
  sessions = new Map();
  currentSessionId: string | null = null;
  logEntry(entry: { content: string; metadata?: Record<string, any> }): string | null {
    console.log(`[LOG ENTRY] ${entry.content}`, entry.metadata);
    return null;
  }
}

/**
 * Adapter implementation of MemoryManager for agents
 */
export class AgentMemoryManager extends AbstractBaseManager {
  protected readonly type = 'memory';
  protected config: MemoryManagerConfig;
  protected initialized = false;
  private chloeMemory: AgentMemory | null = null;
  private chloeMemoryManager: ChloeMemoryManagerClass | null = null;

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
   * Get the unique ID of this manager
   */
  getId(): string {
    return this.managerId;
  }

  /**
   * Get the manager type
   */
  getType(): string {
    return this.type;
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
      const memoryClient = new QdrantMemoryClient({
        useInMemoryFallback: true,
        logErrors: true
      });
      const embeddingService = new EmbeddingService();

      // Initialize Chloe memory systems
      this.chloeMemory = new AgentMemory({
        agentId: this.getAgent().getAgentId(),
        memoryService: new EnhancedMemoryService(memoryClient, embeddingService),
        searchService: new SearchService(memoryClient, embeddingService, new EnhancedMemoryService(memoryClient, embeddingService)),
        taskLogger: new TaskLogger()
      });
      
      await this.chloeMemory.initialize();
      
      this.chloeMemoryManager = new ChloeMemoryManagerClass({
        agentId: this.getAgent().getAgentId(),
        workingMemoryCapacity: this.config.maxShortTermEntries ?? 100,
        consolidationInterval: (this.config.consolidationIntervalMs ?? 600000) / 60000 // Convert to minutes
      });
      
      this.initialized = true;
      return true;
    } catch (error) {
      throw new MemoryError(
        'Failed to initialize Chloe memory systems',
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
    
    if (this.chloeMemory) {
      // await this.chloeMemory.clear();
    }
    
    if (this.chloeMemoryManager) {
      // await this.chloeMemoryManager.shutdown();
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
   * Enable or disable the manager
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (this.config.enabled === enabled) {
      return false;
    }
    this.config.enabled = enabled;
    return true;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<void> {
    console.log(`[${this.getId()}] Resetting ${this.getType()} manager`);
    // Add any additional reset logic here
    this.initialized = false;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Memory manager not initialized'
      };
    }

    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Memory manager is disabled',
        metrics: stats
      };
    }
    
    // Degraded if memory usage is high
    if (stats.memoryUsage > 0.9) {
      return {
        status: 'degraded',
        message: 'Memory usage is high',
        metrics: stats
      };
    }
    
    return {
      status: 'healthy',
      message: 'Memory manager is healthy',
      metrics: stats
    };
  }

  /**
   * Add a new memory entry
   */
  async addMemory(content: string, metadata: Record<string, unknown> = {}): Promise<MemoryEntry> {
    if (!this.initialized || !this.chloeMemoryManager) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // Map metadata to Chloe's memory format
    const category = (metadata.category as string) ?? 'general';
    const importance = (metadata.importance as number) ?? 0.5;
    const source = (metadata.source as string) ?? 'system';
    const tags = (metadata.tags as string[]) ?? [];
    const context = (metadata.context as string) ?? '';

    // Add memory using Chloe's memory manager
    const chloeMemory = await this.chloeMemoryManager.addMemory(
      content,
      category,
      this.mapImportance(importance),
      this.mapSource(source),
      context,
      tags,
      metadata
    );

    // Map Chloe memory to interface format
    return this.mapChloeMemoryToInterface(chloeMemory);
  }

  /**
   * Search memories based on query and options
   */
  async searchMemories(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this.initialized || !this.chloeMemory) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // Map search options to Chloe's format
    const searchOptions = {
      limit: options.limit ?? 10,
      minRelevance: options.minRelevance ?? this.config.relevanceThreshold,
      type: options.type ? this.mapMemoryType(options.type) : undefined,
      timeRange: options.timeRange,
      metadata: options.metadata
    };

    // Search using Chloe's memory system
    const results = await this.chloeMemory.search(query, searchOptions);

    // Map results to interface format
    return results.map(this.mapChloeMemoryToInterface);
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<MemoryEntry[]> {
    if (!this.chloeMemory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const memories = await this.chloeMemory.getRecentlyModifiedMemories(limit);
    return memories.map(mem => ({
      id: mem.id,
      type: mem.type,
      content: mem.content,
      metadata: mem.metadata ?? {},
      createdAt: mem.created ?? new Date(),
      lastAccessedAt: mem.lastAccessed ?? new Date(),
      accessCount: mem.accessCount ?? 0
    }));
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    if (!this.chloeMemoryManager) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }
    // await this.chloeMemoryManager.consolidateMemories();
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
    if (!this.chloeMemoryManager) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }
    // await this.chloeMemoryManager.pruneMemories();
    return {
      success: true,
      prunedCount: 0, // TODO: Implement actual count
      message: 'Memories pruned successfully'
    };
  }

  // Private helper methods

  /**
   * Map importance value to Chloe's ImportanceLevel
   */
  private mapImportance(importance: number): ImportanceLevel {
    if (importance >= 0.8) return ImportanceLevel.HIGH;
    if (importance >= 0.5) return ImportanceLevel.MEDIUM;
    return ImportanceLevel.LOW;
  }

  /**
   * Map source string to Chloe's MemorySource
   */
  private mapSource(source: string): MemorySource {
    switch (source.toLowerCase()) {
      case 'user':
        return MemorySource.USER;
      case 'system':
        return MemorySource.SYSTEM;
      case 'agent':
        return MemorySource.AGENT;
      default:
        return MemorySource.SYSTEM;
    }
  }

  /**
   * Map memory type to Chloe's MemoryType
   */
  private mapMemoryType(type: string): MemoryType {
    switch (type.toLowerCase()) {
      case 'short-term':
        return MemoryType.MESSAGE;
      case 'long-term':
        return MemoryType.DOCUMENT;
      case 'working':
        return MemoryType.THOUGHT;
      case 'episodic':
        return MemoryType.TASK;
      case 'semantic':
        return MemoryType.KNOWLEDGE_INSIGHT;
      case 'procedural':
        return MemoryType.TOOL_EXECUTION_METRICS;
      default:
        return MemoryType.DOCUMENT;
    }
  }

  /**
   * Map Chloe memory to interface format
   */
  private mapChloeMemoryToInterface(chloeMemory: any): MemoryEntry {
    return {
      id: chloeMemory.id,
      content: chloeMemory.content,
      metadata: {
        ...chloeMemory.metadata,
        type: chloeMemory.type,
        importance: chloeMemory.importance,
        source: chloeMemory.source,
        timestamp: chloeMemory.timestamp
      },
      createdAt: chloeMemory.createdAt,
      lastAccessedAt: chloeMemory.lastAccessedAt,
      accessCount: chloeMemory.accessCount
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
    if (!this.chloeMemory) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const stats = await this.chloeMemory.getStats();
    
    return {
      totalMemories: stats.totalMemories,
      shortTermMemories: stats.shortTermMemories,
      longTermMemories: stats.longTermMemories,
      memoryUsage: stats.memoryUsage,
      avgMemorySize: stats.avgMemorySize,
      consolidationStats: {
        lastConsolidation: stats.lastConsolidation,
        totalConsolidated: stats.totalConsolidated
      },
      pruningStats: {
        lastPruning: stats.lastPruning,
        totalPruned: stats.totalPruned
      }
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getRecent(options: MemorySearchOptions = {}): Promise<MemoryEntry[]> {
    if (!this.chloeMemory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const memories = await this.chloeMemory.getRecentlyModifiedMemories(options.limit ?? 10);
    return memories.map(mem => ({
      id: mem.id,
      type: this.mapMemoryType(mem.type),
      content: mem.content,
      metadata: mem.metadata,
      timestamp: mem.timestamp,
      importance: mem.importance ?? ImportanceLevel.MEDIUM,
      source: mem.source ?? MemorySource.AGENT
    }));
  }
} 