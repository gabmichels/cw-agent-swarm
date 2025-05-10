/**
 * DefaultMemoryManager.ts - Default implementation of the MemoryManager interface
 * 
 * This file provides a concrete implementation of the MemoryManager interface
 * that can be used by any agent implementation. It includes memory storage,
 * retrieval, consolidation, and pruning capabilities.
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
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Error class for memory-related errors
 */
class MemoryError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'MEMORY_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the MemoryManager interface
 */
export class DefaultMemoryManager implements MemoryManager {
  private readonly managerId: string;
  private readonly managerType = 'memory';
  private config: MemoryManagerConfig;
  private agent: AgentBase;
  private memories: Map<string, MemoryEntry> = new Map();
  private initialized = false;
  private pruningTimer: NodeJS.Timeout | null = null;
  private consolidationTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new DefaultMemoryManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<MemoryManagerConfig> = {}) {
    this.managerId = `memory-manager-${uuidv4()}`;
    this.agent = agent;
    this.config = {
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
   * Get the associated agent instance
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // Setup auto-pruning if enabled
    if (this.config.enableAutoPruning) {
      this.setupAutoPruning();
    }
    
    // Setup auto-consolidation if enabled
    if (this.config.enableAutoConsolidation) {
      this.setupAutoConsolidation();
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Clear timers
    if (this.pruningTimer) {
      clearInterval(this.pruningTimer);
      this.pruningTimer = null;
    }
    
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
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
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    this.memories.clear();
    return true;
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
    if (!this.initialized) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const memoryId = uuidv4();
    const timestamp = new Date();
    
    const memory: MemoryEntry = {
      id: memoryId,
      content,
      metadata: {
        ...metadata,
        timestamp,
        type: metadata.type ?? 'short-term',
        importance: metadata.importance ?? 0.5,
        source: metadata.source ?? 'agent'
      },
      createdAt: timestamp,
      lastAccessedAt: timestamp,
      accessCount: 0
    };
    
    this.memories.set(memoryId, memory);
    
    // Check if we need to prune after adding
    if (this.config.enableAutoPruning) {
      const shortTermMemories = Array.from(this.memories.values())
        .filter(m => m.metadata.type === 'short-term');
      
      if (shortTermMemories.length > (this.config.maxShortTermEntries ?? 100)) {
        await this.pruneMemories();
      }
    }
    
    return memory;
  }

  /**
   * Search memories based on query and options
   */
  async searchMemories(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const {
      limit = 10,
      minRelevance = this.config.relevanceThreshold ?? 0.2,
      type,
      timeRange,
      metadata
    } = options;
    
    // Convert memories to array for filtering
    let results = Array.from(this.memories.values());
    
    // Apply filters
    if (type) {
      results = results.filter(m => m.metadata.type === type);
    }
    
    if (timeRange) {
      const { start, end } = timeRange;
      results = results.filter(m => {
        const timestamp = m.metadata.timestamp as Date;
        return (!start || timestamp >= start) && (!end || timestamp <= end);
      });
    }
    
    if (metadata) {
      results = results.filter(m => {
        return Object.entries(metadata).every(([key, value]) => 
          m.metadata[key] === value
        );
      });
    }
    
    // Simple relevance scoring based on content matching
    // In a real implementation, this would use embeddings or other semantic search
    const scoredResults = results.map(memory => {
      const contentWords = memory.content.toLowerCase().split(/\s+/);
      const queryWords = query.toLowerCase().split(/\s+/);
      
      const matchingWords = queryWords.filter(word => 
        contentWords.includes(word)
      ).length;
      
      const relevance = matchingWords / queryWords.length;
      
      return {
        memory,
        relevance
      };
    });
    
    // Filter by minimum relevance and sort by relevance
    return scoredResults
      .filter(r => r.relevance >= minRelevance)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(r => {
        // Update access metrics
        const memory = r.memory;
        memory.lastAccessedAt = new Date();
        memory.accessCount++;
        this.memories.set(memory.id, memory);
        
        return memory;
      });
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit = 10): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.memories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    if (!this.initialized) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const shortTermMemories = Array.from(this.memories.values())
      .filter(m => m.metadata.type === 'short-term');
    
    if (shortTermMemories.length < (this.config.minMemoriesForConsolidation ?? 5)) {
      return {
        success: true,
        consolidatedCount: 0,
        message: 'Not enough memories to consolidate'
      };
    }
    
    // Group memories by topic/context
    const groups = this.groupMemoriesByContext(shortTermMemories);
    
    let consolidatedCount = 0;
    
    // Consolidate each group
    for (const group of groups) {
      if (group.length < 2) continue;
      
      // Create consolidated memory
      const consolidatedMemory = await this.createConsolidatedMemory(group);
      
      // Add consolidated memory
      await this.addMemory(consolidatedMemory.content, {
        ...consolidatedMemory.metadata,
        type: 'long-term',
        source: 'consolidation',
        originalMemoryIds: group.map(m => m.id)
      });
      
      consolidatedCount++;
      
      // Remove source memories if configured
      if (this.config.forgetSourceMemoriesAfterConsolidation) {
        for (const memory of group) {
          this.memories.delete(memory.id);
        }
      }
    }
    
    return {
      success: true,
      consolidatedCount,
      message: `Consolidated ${consolidatedCount} groups of memories`
    };
  }

  /**
   * Prune memories based on relevance and age
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    if (!this.initialized) {
      throw new MemoryError(
        'Memory manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const shortTermMemories = Array.from(this.memories.values())
      .filter(m => m.metadata.type === 'short-term');
    
    if (shortTermMemories.length <= (this.config.maxShortTermEntries ?? 100)) {
      return {
        success: true,
        prunedCount: 0,
        message: 'No pruning needed'
      };
    }
    
    // Sort by importance and recency
    const sortedMemories = shortTermMemories.sort((a, b) => {
      const importanceA = a.metadata.importance as number;
      const importanceB = b.metadata.importance as number;
      
      if (importanceA !== importanceB) {
        return importanceB - importanceA;
      }
      
      return b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime();
    });
    
    // Remove excess memories
    const toRemove = sortedMemories.slice(this.config.maxShortTermEntries ?? 100);
    let prunedCount = 0;
    
    for (const memory of toRemove) {
      this.memories.delete(memory.id);
      prunedCount++;
    }
    
    return {
      success: true,
      prunedCount,
      message: `Pruned ${prunedCount} memories`
    };
  }

  /**
   * Get memory manager statistics
   */
  async getStats(): Promise<{
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
    const allMemories = Array.from(this.memories.values());
    const shortTermMemories = allMemories.filter(m => m.metadata.type === 'short-term');
    const longTermMemories = allMemories.filter(m => m.metadata.type === 'long-term');
    
    const totalSize = allMemories.reduce((sum, m) => 
      sum + JSON.stringify(m).length, 0
    );
    
    return {
      totalMemories: allMemories.length,
      shortTermMemories: shortTermMemories.length,
      longTermMemories: longTermMemories.length,
      memoryUsage: allMemories.length / (this.config.maxShortTermEntries ?? 100),
      avgMemorySize: allMemories.length > 0 ? totalSize / allMemories.length : 0,
      consolidationStats: {
        lastConsolidation: null, // To be implemented with tracking
        totalConsolidated: 0 // To be implemented with tracking
      },
      pruningStats: {
        lastPruning: null, // To be implemented with tracking
        totalPruned: 0 // To be implemented with tracking
      }
    };
  }

  // Private helper methods

  /**
   * Setup automatic memory pruning
   */
  private setupAutoPruning(): void {
    if (this.pruningTimer) {
      clearInterval(this.pruningTimer);
    }
    
    this.pruningTimer = setInterval(async () => {
      try {
        await this.pruneMemories();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-pruning:`, error);
      }
    }, this.config.pruningIntervalMs);
  }

  /**
   * Setup automatic memory consolidation
   */
  private setupAutoConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }
    
    this.consolidationTimer = setInterval(async () => {
      try {
        await this.consolidateMemories();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-consolidation:`, error);
      }
    }, this.config.consolidationIntervalMs);
  }

  /**
   * Group memories by context/topic
   */
  private groupMemoriesByContext(memories: MemoryEntry[]): MemoryEntry[][] {
    // Simple grouping based on content similarity
    // In a real implementation, this would use embeddings or other semantic analysis
    const groups: MemoryEntry[][] = [];
    const processed = new Set<string>();
    
    for (const memory of memories) {
      if (processed.has(memory.id)) continue;
      
      const group: MemoryEntry[] = [memory];
      processed.add(memory.id);
      
      // Find similar memories
      for (const other of memories) {
        if (processed.has(other.id)) continue;
        
        // Simple similarity check based on word overlap
        const similarity = this.calculateSimilarity(memory.content, other.content);
        
        if (similarity > 0.5) { // Threshold for grouping
          group.push(other);
          processed.add(other.id);
        }
      }
      
      if (group.length > 1) {
        groups.push(group);
      }
    }
    
    return groups;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    
    const intersection = words1Array.filter(x => words2.has(x));
    const union = new Set([...words1Array, ...words2Array]);
    
    return intersection.length / union.size;
  }

  /**
   * Create a consolidated memory from a group of memories
   */
  private async createConsolidatedMemory(memories: MemoryEntry[]): Promise<MemoryEntry> {
    // In a real implementation, this would use LLM or other techniques
    // to create a coherent summary of the memories
    const content = memories.map(m => m.content).join('\n\n');
    
    // Calculate max importance, defaulting to 0.5 if not set
    const maxImportance = Math.max(
      ...memories.map(m => (m.metadata.importance as number) ?? 0.5)
    );
    
    return {
      id: uuidv4(),
      content,
      metadata: {
        type: 'long-term',
        importance: maxImportance,
        source: 'consolidation',
        timestamp: new Date()
      },
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };
  }
} 