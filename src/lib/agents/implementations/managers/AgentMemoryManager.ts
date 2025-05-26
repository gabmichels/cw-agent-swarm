/**
 * AgentMemoryManager.ts - Adapter implementation of MemoryManager for agents
 * 
 * This file provides an adapter implementation that bridges between the
 * MemoryManager interface and the agent's memory system.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  MemoryManager, 
  MemoryEntry,
  MemorySearchOptions as BaseMemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../../../agents/base/managers/MemoryManager';
import { AbstractBaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { DefaultAgentMemory } from '../memory/DefaultAgentMemory';
import { MemoryType, ImportanceLevel, MemorySource } from '../../../../lib/constants/memory';
import { QdrantMemoryClient } from '../../../../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../../server/memory/services/client/embedding-service';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryEntry as SharedMemoryEntry, MemorySearchOptions } from '../../shared/memory/types';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';

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

export interface MemoryManagerConfig extends ManagerConfig {
  // Add memory-specific configuration options here
}

/**
 * Adapter implementation of MemoryManager for agents
 */
export class AgentMemoryManager extends AbstractBaseManager implements MemoryManager {
  protected config: MemoryManagerConfig;
  private memory: DefaultAgentMemory | null = null;
  protected _initialized: boolean = false;
  private consolidationCount: number = 0;
  private prunedCount: number = 0;
  private lastConsolidationDate: Date | null = null;
  private lastPruningDate: Date | null = null;

  /**
   * Create a new AgentMemoryManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: MemoryManagerConfig) {
    super(`memory-manager-${uuidv4()}`, ManagerType.MEMORY, agent, config);
    this.config = config;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }

    try {
      // Initialize memory system
      this.memory = new DefaultAgentMemory(this.getAgent().getAgentId());
      await this.memory.initialize();
      
      this._initialized = true;
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
    if (this.memory) {
      await this.memory.shutdown();
    }
    
    this._initialized = false;
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
  async reset(): Promise<boolean> {
    // Implement memory manager reset logic
    return true;
  }

  /**
   * Add a memory entry
   */
  async addMemory(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry> {
    if (!this._initialized) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }

    return await this.memory!.addMemory(
      content,
      MemoryType.DOCUMENT,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      metadata
    );
  }

  /**
   * Search for memories
   */
  async searchMemories(query: string, options?: BaseMemorySearchOptions): Promise<MemoryEntry[]> {
    if (!this._initialized) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const searchOptions: MemorySearchOptions = {
      limit: options?.limit,
      minScore: options?.minRelevance,
      type: options?.type === 'short-term' ? MemoryType.MESSAGE : 
            options?.type === 'long-term' ? MemoryType.DOCUMENT : undefined,
      metadata: options?.metadata
    };
    const results = await this.memory!.search(query, searchOptions);
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
    if (!this._initialized) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    const memories = await this.memory!.getRecentlyModifiedMemories(limit);
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
    
    // Get count before consolidation
    const beforeStats = await this.memory.getStats();
    const beforeCount = beforeStats.totalMemories;
    
    await this.memory.consolidateMemories();
    
    // Get count after consolidation to calculate how many were consolidated
    const afterStats = await this.memory.getStats();
    const afterCount = afterStats.totalMemories;
    const consolidatedThisRun = beforeCount - afterCount;
    
    // Update tracking
    this.consolidationCount += consolidatedThisRun;
    this.lastConsolidationDate = new Date();
    
    return {
      success: true,
      consolidatedCount: consolidatedThisRun,
      message: `Successfully consolidated ${consolidatedThisRun} memories`
    };
  }

  /**
   * Prune memories based on relevance and age
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    if (!this.memory) {
      throw new MemoryError('Memory system not initialized', 'NOT_INITIALIZED');
    }
    
    // Get count before pruning
    const beforeStats = await this.memory.getStats();
    const beforeCount = beforeStats.totalMemories;
    
    await this.memory.pruneMemories();
    
    // Get count after pruning to calculate how many were pruned
    const afterStats = await this.memory.getStats();
    const afterCount = afterStats.totalMemories;
    const prunedThisRun = beforeCount - afterCount;
    
    // Update tracking
    this.prunedCount += prunedThisRun;
    this.lastPruningDate = new Date();
    
    return {
      success: true,
      prunedCount: prunedThisRun,
      message: `Successfully pruned ${prunedThisRun} memories`
    };
  }

  /**
   * Get total consolidation count
   */
  getTotalConsolidationCount(): number {
    return this.consolidationCount;
  }

  /**
   * Get total pruned count
   */
  getTotalPrunedCount(): number {
    return this.prunedCount;
  }

  /**
   * Get last consolidation date
   */
  getLastConsolidationDate(): Date | null {
    return this.lastConsolidationDate;
  }

  /**
   * Get last pruning date
   */
  getLastPruningDate(): Date | null {
    return this.lastPruningDate;
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

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Memory manager not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    const stats = await this.getStats();
    const issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string; detectedAt: Date }> = [];

    // Check memory system health
    if (!this.memory) {
      issues.push({
        severity: 'critical',
        message: 'Memory system not available',
        detectedAt: new Date()
      });
    }

    // Check memory usage
    if (stats.memoryUsage > 90) {
      issues.push({
        severity: 'high',
        message: 'High memory usage detected',
        detectedAt: new Date()
      });
    }

    // Check consolidation status
    if (!stats.consolidationStats.lastConsolidation || 
        Date.now() - stats.consolidationStats.lastConsolidation.getTime() > 24 * 60 * 60 * 1000) {
      issues.push({
        severity: 'medium',
        message: 'Memory consolidation overdue',
        detectedAt: new Date()
      });
    }

    return {
      status: issues.some(i => i.severity === 'critical') ? 'unhealthy' :
             issues.some(i => i.severity === 'high') ? 'degraded' : 'healthy',
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          totalMemories: stats.totalMemories,
          shortTermMemories: stats.shortTermMemories,
          longTermMemories: stats.longTermMemories,
          memoryUsage: stats.memoryUsage,
          avgMemorySize: stats.avgMemorySize,
          consolidation: stats.consolidationStats,
          pruning: stats.pruningStats
        }
      }
    };
  }
} 