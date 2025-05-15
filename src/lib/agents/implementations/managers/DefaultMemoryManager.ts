/**
 * DefaultMemoryManager.ts - Core memory management implementation
 * 
 * This file provides the base memory manager implementation with support for:
 * - Basic memory operations (CRUD)
 * - Memory isolation between agents
 * - Memory versioning
 * - Memory pruning and consolidation
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  MemoryManager, 
  MemoryManagerConfig,
  MemoryEntry,
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../../../../agents/shared/base/managers/MemoryManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { 
  MemoryIsolationManager,
  DEFAULT_MEMORY_ISOLATION_CONFIG,
  MemoryIsolationConfig 
} from '../../../../agents/shared/memory/MemoryIsolationManager';
import {
  MemoryScope,
  MemoryAccessLevel,
  MemoryPermission
} from '../../../../agents/shared/memory/MemoryScope';

/**
 * Extended configuration for DefaultMemoryManager
 */
export interface DefaultMemoryManagerConfig extends MemoryManagerConfig {
  /**
   * Isolation-specific configuration
   */
  isolation?: Partial<MemoryIsolationConfig>;
  
  /**
   * Whether to create a private scope for the agent
   */
  createPrivateScope?: boolean;
  
  /**
   * Default scope name for the agent
   */
  defaultScopeName?: string;
  
  /**
   * Memory types allowed in the agent's scopes
   */
  allowedMemoryTypes?: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_MANAGER_CONFIG: DefaultMemoryManagerConfig = {
  enabled: true,
  enableAutoPruning: true,
  pruningIntervalMs: 300000, // 5 minutes
  maxShortTermEntries: 100,
  relevanceThreshold: 0.2,
  enableAutoConsolidation: true,
  consolidationIntervalMs: 600000, // 10 minutes
  minMemoriesForConsolidation: 5,
  forgetSourceMemoriesAfterConsolidation: false,
  createPrivateScope: true,
  defaultScopeName: 'private'
};

/**
 * Error class for memory-related errors
 */
export class MemoryError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'MEMORY_ERROR',
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

/**
 * Default implementation of the MemoryManager interface
 */
export class DefaultMemoryManager extends AbstractBaseManager implements MemoryManager {
  protected memories: Map<string, MemoryEntry> = new Map();
  protected pruningTimer: NodeJS.Timeout | null = null;
  protected consolidationTimer: NodeJS.Timeout | null = null;
  protected _config: DefaultMemoryManagerConfig;
  
  /**
   * Memory isolation manager
   */
  protected isolationManager: MemoryIsolationManager;
  
  /**
   * Agent-specific private scope
   */
  protected privateScope?: MemoryScope;
  
  /**
   * Default shared scope for cross-agent communication
   */
  protected sharedScope?: MemoryScope;
  
  /**
   * Create a new DefaultMemoryManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<DefaultMemoryManagerConfig> = {}) {
    super(
      `memory-manager-${uuidv4()}`,
      ManagerType.MEMORY,
      agent,
      { enabled: true }
    );
    
    // Merge defaults with provided config
    this._config = {
      ...DEFAULT_MEMORY_MANAGER_CONFIG,
      ...config
    } as DefaultMemoryManagerConfig;
    
    // Create isolation manager
    this.isolationManager = new MemoryIsolationManager(
      this._config.isolation || DEFAULT_MEMORY_ISOLATION_CONFIG
    );
  }

  /**
   * Add a new memory entry (alias for storeMemory)
   */
  async addMemory(content: string, metadata: Record<string, unknown> = {}): Promise<MemoryEntry> {
    return this.storeMemory(content, metadata);
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit = 10): Promise<MemoryEntry[]> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    // Get memories from accessible scopes
    const accessibleScopes = this.isolationManager.getScopesForAgent(
      this.getAgent().getAgentId()
    );

    // Get memories from accessible scopes
    const accessibleMemories = Array.from(this.memories.values()).filter(memory => {
      const memoryScope = accessibleScopes.find(
        scope => scope.scopeId.id === memory.metadata.scopeId
      );
      return memoryScope !== undefined;
    });

    // Sort by creation date
    return accessibleMemories
      .sort((a, b) => {
        const aDate = new Date(a.metadata.createdAt as string);
        const bDate = new Date(b.metadata.createdAt as string);
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }

    try {
      console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
      
      // Create private scope for the agent if enabled
      if (this._config.createPrivateScope) {
        this.privateScope = this.isolationManager.createScope({
          name: this._config.defaultScopeName || 'private',
          description: `Private memory space for agent ${this.getAgent().getAgentId()}`,
          accessLevel: MemoryAccessLevel.PRIVATE,
          ownerAgentId: this.getAgent().getAgentId(),
          allowedMemoryTypes: this._config.allowedMemoryTypes
        });
        
        console.log(`Created private scope for agent ${this.getAgent().getAgentId()}: ${this.privateScope.scopeId.id}`);
      }
      
      // Locate shared scope
      const scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
      this.sharedScope = scopes.find(s => s.accessPolicy.accessLevel === MemoryAccessLevel.PUBLIC);
      
      if (this.sharedScope) {
        console.log(`Found shared scope: ${this.sharedScope.scopeId.id}`);
      } else {
        console.warn('No shared scope available');
      }
      
      // Setup auto-pruning if enabled
      if (this._config.enableAutoPruning) {
        this.setupAutoPruning();
      }
      
      // Setup auto-consolidation if enabled
      if (this._config.enableAutoConsolidation) {
        this.setupAutoConsolidation();
      }
      
      this._initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Error during initialization:`, error);
      return false;
    }
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
    
    this._initialized = false;
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
   * Get the health status of the manager
   */
  async getHealth(): Promise<ManagerHealth> {
    return {
      status: this._initialized ? 'healthy' : 'unhealthy',
      message: `Memory manager is ${this._initialized ? 'healthy' : 'unhealthy'}`,
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          totalMemories: this.memories.size,
          privateMemories: this.privateScope ? 
            Array.from(this.memories.values()).filter(
              m => m.metadata.scopeId === this.privateScope!.scopeId.id
            ).length : 0,
          sharedMemories: this.sharedScope ?
            Array.from(this.memories.values()).filter(
              m => m.metadata.scopeId === this.sharedScope!.scopeId.id
            ).length : 0
        }
      }
    };
  }

  // #region Memory Operations

  /**
   * Store a new memory
   */
  async storeMemory(
    content: string,
    metadata: Record<string, unknown> = {},
    scope: MemoryScope = this.privateScope!
  ): Promise<MemoryEntry> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    const now = new Date();
    const memory: MemoryEntry = {
      id: uuidv4(),
      content,
      metadata: {
        ...metadata,
        createdAt: now.toISOString(),
        createdBy: this.getAgent().getAgentId(),
        scopeId: scope.scopeId.id
      },
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0
    };

    // Store in memory map
    this.memories.set(memory.id, memory);

    // Store in isolation scope
    const accessResult = this.isolationManager.checkAccess(
      this.getAgent().getAgentId(),
      scope.scopeId.id,
      MemoryPermission.WRITE
    );

    if (!accessResult.granted) {
      throw new MemoryError(
        `Agent ${this.getAgent().getAgentId()} does not have write access to scope ${scope.scopeId.id}`,
        'PERMISSION_DENIED'
      );
    }

    return memory;
  }

  /**
   * Retrieve a memory by ID
   */
  async getMemory(id: string): Promise<MemoryEntry | null> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    return this.memories.get(id) || null;
  }

  /**
   * Search memories based on criteria
   */
  async searchMemories(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    // Get accessible scopes for the agent
    const accessibleScopes = this.isolationManager.getScopesForAgent(
      this.getAgent().getAgentId()
    );

    // Get memories from accessible scopes
    const accessibleMemories = Array.from(this.memories.values()).filter(memory => {
      const memoryScope = accessibleScopes.find(
        scope => scope.scopeId.id === memory.metadata.scopeId
      );
      return memoryScope !== undefined;
    });

    // Apply search criteria (simple implementation - would use embeddings in production)
    let results = accessibleMemories.filter(memory => {
      const content = memory.content.toLowerCase();
      const searchTerms = query.toLowerCase().split(' ');
      return searchTerms.every(term => content.includes(term));
    });

    // Apply time range filter if specified
    if (options.timeRange) {
      results = results.filter(memory => {
        const { start, end } = options.timeRange!;
        return (!start || memory.createdAt >= start) && (!end || memory.createdAt <= end);
      });
    }

    // Apply metadata filter if specified
    if (options.metadata) {
      results = results.filter(memory => {
        return Object.entries(options.metadata!).every(([key, value]) => 
          memory.metadata[key] === value
        );
      });
    }

    // Apply type filter if specified
    if (options.type) {
      results = results.filter(memory => 
        memory.metadata.type === options.type
      );
    }

    // Apply minimum relevance filter
    if (options.minRelevance) {
      results = results.filter(memory => 
        (memory.metadata.relevance as number || 0.5) >= options.minRelevance!
      );
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    id: string,
    updates: Partial<MemoryEntry>
  ): Promise<MemoryEntry> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    const memory = await this.getMemory(id);
    if (!memory) {
      throw new MemoryError(`Memory ${id} not found`, 'MEMORY_NOT_FOUND');
    }

    // Check access permissions
    const memoryScope = this.isolationManager.getScope(memory.metadata.scopeId as string);
    if (!memoryScope) {
      throw new MemoryError(`Scope not found for memory ${id}`, 'SCOPE_NOT_FOUND');
    }

    const accessResult = this.isolationManager.checkAccess(
      this.getAgent().getAgentId(),
      memoryScope.scopeId.id,
      MemoryPermission.WRITE
    );

    if (!accessResult.granted) {
      throw new MemoryError(
        `Agent ${this.getAgent().getAgentId()} does not have write access to memory ${id}`,
        'PERMISSION_DENIED'
      );
    }

    // Update memory
    const updatedMemory = {
      ...memory,
      ...updates,
      metadata: {
        ...memory.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        updatedBy: this.getAgent().getAgentId()
      }
    };

    this.memories.set(id, updatedMemory);

    return updatedMemory;
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<boolean> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    const memory = await this.getMemory(id);
    if (!memory) {
      return false;
    }

    // Check access permissions
    const memoryScope = this.isolationManager.getScope(memory.metadata.scopeId as string);
    if (!memoryScope) {
      throw new MemoryError(`Scope not found for memory ${id}`, 'SCOPE_NOT_FOUND');
    }

    const accessResult = this.isolationManager.checkAccess(
      this.getAgent().getAgentId(),
      memoryScope.scopeId.id,
      MemoryPermission.WRITE
    );

    if (!accessResult.granted) {
      throw new MemoryError(
        `Agent ${this.getAgent().getAgentId()} does not have write access to memory ${id}`,
        'PERMISSION_DENIED'
      );
    }

    // Remove from memory map
    this.memories.delete(id);

    return true;
  }

  // #endregion Memory Operations

  // #region Memory Maintenance

  /**
   * Setup automatic memory pruning
   */
  protected setupAutoPruning(): void {
    const interval = this._config.pruningIntervalMs || 300000; // 5 minutes
    
    // Clear any existing timer
    if (this.pruningTimer) {
      clearInterval(this.pruningTimer);
    }
    
    // Set up new timer
    this.pruningTimer = setInterval(async () => {
      try {
        await this.pruneMemories();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-pruning:`, error);
      }
    }, interval);
    
    console.log(`[${this.managerId}] Set up memory pruning with interval ${interval}ms`);
  }

  /**
   * Setup automatic memory consolidation
   */
  protected setupAutoConsolidation(): void {
    const interval = this._config.consolidationIntervalMs || 600000; // 10 minutes
    
    // Clear any existing timer
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }
    
    // Set up new timer
    this.consolidationTimer = setInterval(async () => {
      try {
        await this.consolidateMemories();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-consolidation:`, error);
      }
    }, interval);
    
    console.log(`[${this.managerId}] Set up memory consolidation with interval ${interval}ms`);
  }

  /**
   * Prune old or irrelevant memories
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    let prunedCount = 0;

    try {
      // Get memories from private scope
      if (this.privateScope) {
        const privateMemories = Array.from(this.memories.values()).filter(
          memory => memory.metadata.scopeId === this.privateScope!.scopeId.id
        );

        // Prune based on age and relevance
        for (const memory of privateMemories) {
          try {
            const age = Date.now() - memory.createdAt.getTime();
            const relevance = memory.metadata.relevance as number || 0.5;

            // Prune if old and low relevance
            if (age > 24 * 60 * 60 * 1000 && relevance < this._config.relevanceThreshold!) {
              await this.deleteMemory(memory.id);
              prunedCount++;
            }
          } catch (error) {
            console.error(`Error pruning memory ${memory.id}:`, error);
          }
        }
      }

      return {
        success: true,
        prunedCount,
        message: `Pruned ${prunedCount} memories`
      };
    } catch (error) {
      return {
        success: false,
        prunedCount: 0,
        message: `Error during memory pruning: ${(error as Error).message}`
      };
    }
  }

  /**
   * Consolidate related memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    let consolidatedCount = 0;

    try {
      // Get memories from private scope
      if (this.privateScope) {
        const privateMemories = Array.from(this.memories.values()).filter(
          memory => memory.metadata.scopeId === this.privateScope!.scopeId.id
        );

        // Group related memories (simple implementation - would use embeddings in production)
        const groups = new Map<string, MemoryEntry[]>();
        
        privateMemories.forEach(memory => {
          const category = memory.metadata.category as string || 'general';
          const group = groups.get(category) || [];
          group.push(memory);
          groups.set(category, group);
        });

        // Consolidate groups that meet the threshold
        for (const [category, memories] of Array.from(groups.entries())) {
          if (memories.length >= this._config.minMemoriesForConsolidation!) {
            try {
              // Create consolidated memory
              const consolidatedContent = memories
                .map(memory => memory.content)
                .join('\n\n');

              const consolidatedMemory = await this.storeMemory(
                consolidatedContent,
                {
                  category,
                  type: 'consolidated',
                  sourceMemories: memories.map(memory => memory.id),
                  consolidatedAt: new Date().toISOString()
                }
              );

              consolidatedCount++;

              // Optionally delete source memories
              if (this._config.forgetSourceMemoriesAfterConsolidation) {
                await Promise.all(
                  memories.map(memory => this.deleteMemory(memory.id))
                );
              }
            } catch (error) {
              console.error(`Error consolidating memories in category ${category}:`, error);
            }
          }
        }
      }

      return {
        success: true,
        consolidatedCount,
        message: `Consolidated ${consolidatedCount} groups of memories`
      };
    } catch (error) {
      return {
        success: false,
        consolidatedCount: 0,
        message: `Error during memory consolidation: ${(error as Error).message}`
      };
    }
  }

  // #endregion Memory Maintenance
} 