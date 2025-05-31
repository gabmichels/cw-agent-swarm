/**
 * DefaultMemoryManager.ts - Core memory management implementation
 * 
 * This file provides the base memory manager implementation with support for:
 * - Basic memory operations (CRUD)
 * - Memory versioning
 * - Memory pruning and consolidation
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - No placeholder implementations
 * - Industry best practices with ULID IDs
 */

import { ulid } from 'ulid';
import { 
  MemoryManager, 
  MemoryManagerConfig,
  MemoryEntry,
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../../../../agents/shared/base/managers/MemoryManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';

// Import memory services
import { getMemoryServices } from '../../../../server/memory/services';
import { ImportanceLevel } from '../../../../constants/memory';

/**
 * Memory service interface for external connections
 */
export interface MemoryService {
  /**
   * Search memories by type and filter criteria
   */
  searchMemories(query: {
    type: string;
    filter?: Record<string, unknown>;
    limit?: number;
  }): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    }>;
    error?: string;
  }>;
}

/**
 * Extended configuration for DefaultMemoryManager
 */
export interface DefaultMemoryManagerConfig extends MemoryManagerConfig {
  /**
   * Whether this manager is enabled (required by BaseManager)
   */
  enabled: boolean;
  
  /**
   * Auto-pruning configuration
   */
  enableAutoPruning?: boolean;
  pruningIntervalMs?: number;
  relevanceThreshold?: number;
  
  /**
   * Auto-consolidation configuration
   */
  enableAutoConsolidation?: boolean;
  consolidationIntervalMs?: number;
  minMemoriesForConsolidation?: number;
  forgetSourceMemoriesAfterConsolidation?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_MANAGER_CONFIG: DefaultMemoryManagerConfig = {
  enabled: true,
  enableAutoPruning: true,
  pruningIntervalMs: 300000, // 5 minutes
  relevanceThreshold: 0.2,
  enableAutoConsolidation: true,
  consolidationIntervalMs: 600000, // 10 minutes
  minMemoriesForConsolidation: 5,
  forgetSourceMemoriesAfterConsolidation: false
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
export class DefaultMemoryManager implements MemoryManager {
  public readonly managerId: string;
  public readonly managerType: ManagerType = ManagerType.MEMORY;
  
  protected memories: Map<string, MemoryEntry> = new Map();
  protected pruningTimer: NodeJS.Timeout | null = null;
  protected consolidationTimer: NodeJS.Timeout | null = null;
  protected _config: DefaultMemoryManagerConfig;
  protected _initialized: boolean = false;
  
  /**
   * Create a new DefaultMemoryManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    protected agent: AgentBase,
    config: Partial<DefaultMemoryManagerConfig> = {}
  ) {
    this.managerId = `memory-manager-${ulid()}`;
    
    this._config = {
      ...DEFAULT_MEMORY_MANAGER_CONFIG,
      ...config
    };
  }

  /**
   * Get the agent this manager belongs to
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Get the current configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return { ...this._config } as T;
  }

  /**
   * Update the configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    return this._config as T;
  }

  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  /**
   * Get memory service for external interactions
   */
  async getMemoryService(): Promise<MemoryService> {
    try {
      const services = await getMemoryServices();
      
      if (!services || !services.memoryService) {
        console.error(`[${this.managerId}] Memory services not available`);
        throw new Error('Memory services not available');
      }
      
      // Create an adapter that implements the MemoryService interface
      const memoryServiceAdapter: MemoryService = {
        searchMemories: async (query) => {
          try {
            console.log(`[${this.managerId}] Searching memories with query:`, JSON.stringify(query));
            
            const searchResults = await services.searchService.search('', {
              limit: query.limit || 100,
              filter: {
                metadata: {
                  type: query.type,
                  ...(query.filter || {})
                }
              }
            });
            
            if (searchResults && Array.isArray(searchResults)) {
              console.log(`[${this.managerId}] Found ${searchResults.length} items`);
              
              // Transform search results to the expected format
              return {
                success: true,
                data: searchResults.map(item => {
                  // Extract data from the nested point structure
                  const payload = item.point.payload;
                  // Convert BaseMetadata to Record<string, unknown> safely
                  const metadata: Record<string, unknown> = payload.metadata ? 
                    { ...payload.metadata } : 
                    {};
                  
                  return {
                    id: item.point.id,
                    // Use 'text' field which is in BaseMemorySchema, or fallback
                    content: payload.text || '',
                    // Use converted metadata
                    metadata,
                    // Use timestamp from metadata, or current time as fallback
                    createdAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
                    updatedAt: new Date()
                  };
                })
              };
            }
            
            return {
              success: true,
              data: []
            };
          } catch (error) {
            console.error(`[${this.managerId}] Error searching memories:`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }
      };
      
      return memoryServiceAdapter;
    } catch (error) {
      console.error(`[${this.managerId}] Error getting memory service:`, error);
      throw new Error(`Failed to get memory service: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // Get all memories and sort by creation date
    const allMemories = Array.from(this.memories.values());

    // Sort by creation date
    return allMemories
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
          totalMemories: this.memories.size
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
    metadata: Record<string, unknown> = {}
  ): Promise<MemoryEntry> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    const now = new Date();
    const memory: MemoryEntry = {
      id: ulid(), // Use ULID instead of UUID
      content,
      metadata: {
        ...metadata,
        createdAt: now.toISOString(),
        createdBy: this.agent.getAgentId()
      },
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0
    };

    // Store in memory map
    this.memories.set(memory.id, memory);

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

    // Validate query - normalize empty or undefined queries
    const normalizedQuery = query?.trim() || '';
    
    // Get all memories
    const allMemories = Array.from(this.memories.values());

    // Apply search criteria based on query presence
    let results = allMemories;
    
    // Only apply semantic search if we have a non-empty query
    if (normalizedQuery.length > 0) {
      // Apply search criteria (simple implementation - would use embeddings in production)
      results = allMemories.filter(memory => {
        const content = memory.content.toLowerCase();
        const searchTerms = normalizedQuery.toLowerCase().split(' ');
        return searchTerms.every(term => content.includes(term));
      });
    }

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

    // Log search statistics
    const logData = {
      query: normalizedQuery,
      options,
      resultCount: results.length,
      agentId: this.agent.getAgentId(),
      isEmpty: normalizedQuery.length === 0
    };
    
    if (normalizedQuery.length === 0) {
      console.log(`[${this.managerId}] Performing empty query search with filters only:`, 
        JSON.stringify(logData, null, 2));
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

    // Update memory
    const updatedMemory = {
      ...memory,
      ...updates,
      metadata: {
        ...memory.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        updatedBy: this.agent.getAgentId()
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
      const allMemories = Array.from(this.memories.values());

      // Prune based on age and relevance
      for (const memory of allMemories) {
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
   * Consolidate related memories with visualization support
   * 
   * @param visualizationContext Optional visualization context
   */
  async consolidateMemories(
    visualizationContext?: {
      visualization: any; // ThinkingVisualization
      visualizer: any; // VisualizationService
      parentNodeId?: string;
    }
  ): Promise<MemoryConsolidationResult> {
    if (!this._initialized) {
      throw new MemoryError('Memory manager not initialized', 'NOT_INITIALIZED');
    }

    // Generate a new request ID for memory consolidation process
    const requestId = this.generateRequestId();
    
    // Create visualization node if visualization is enabled
    let consolidationNodeId: string | undefined;
    
    if (visualizationContext && 
        visualizationContext.visualization && 
        visualizationContext.visualizer) {
      try {
        // Create memory consolidation visualization node
        consolidationNodeId = visualizationContext.visualizer.addNode(
          visualizationContext.visualization,
          'memory_consolidation',
          'Memory Consolidation Process',
          {
            agentId: this.agent.getAgentId(),
            minMemoriesForConsolidation: this._config.minMemoriesForConsolidation,
            forgetSourceMemories: this._config.forgetSourceMemoriesAfterConsolidation,
            timestamp: Date.now(),
            requestId
          },
          'in_progress'
        );
        
        // Connect to parent node if specified
        if (visualizationContext.parentNodeId && consolidationNodeId) {
          visualizationContext.visualizer.addEdge(
            visualizationContext.visualization,
            visualizationContext.parentNodeId,
            consolidationNodeId,
            'initiated_consolidation'
          );
        }
      } catch (error) {
        console.error('Error creating memory consolidation visualization:', error);
      }
    }

    let consolidatedCount = 0;
    const consolidatedGroups: Array<{
      category: string;
      count: number;
      contentPreview: string;
    }> = [];

    try {
      const allMemories = Array.from(this.memories.values());

      // Update visualization with scanning info if available
      if (visualizationContext && consolidationNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            consolidationNodeId,
            {
              data: {
                status: 'scanning',
                totalMemories: allMemories.length,
                timestamp: Date.now()
              }
            }
          );
        } catch (error) {
          console.error('Error updating memory consolidation visualization:', error);
        }
      }

      // Group related memories (simple implementation - would use embeddings in production)
      const groups = new Map<string, MemoryEntry[]>();
      
      allMemories.forEach(memory => {
        const category = memory.metadata.category as string || 'general';
        const group = groups.get(category) || [];
        group.push(memory);
        groups.set(category, group);
      });

      // Update visualization with grouping info if available
      if (visualizationContext && consolidationNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            consolidationNodeId,
            {
              data: {
                status: 'grouping',
                groupCount: groups.size,
                groups: Array.from(groups.keys()),
                timestamp: Date.now()
              }
            }
          );
        } catch (error) {
          console.error('Error updating memory consolidation visualization:', error);
        }
      }

      // Consolidate groups that meet the threshold
      for (const [category, memories] of Array.from(groups.entries())) {
        if (memories.length >= this._config.minMemoriesForConsolidation!) {
          // Create category-specific visualization node if enabled
          let categoryNodeId: string | undefined;
          
          if (visualizationContext && 
              visualizationContext.visualization && 
              visualizationContext.visualizer && 
              consolidationNodeId) {
            try {
              // Create category consolidation node
              categoryNodeId = visualizationContext.visualizer.addNode(
                visualizationContext.visualization,
                'memory_group_consolidation',
                `Consolidating ${category} Memories`,
                {
                  category,
                  memoryCount: memories.length,
                  timestamp: Date.now()
                },
                'in_progress'
              );
              
              // Connect to consolidation parent node
              if (categoryNodeId) {
                visualizationContext.visualizer.addEdge(
                  visualizationContext.visualization,
                  consolidationNodeId,
                  categoryNodeId,
                  'consolidates_category'
                );
              }
            } catch (error) {
              console.error(`Error creating category consolidation visualization for ${category}:`, error);
            }
          }
          
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
            
            // Add to group tracking for visualization
            consolidatedGroups.push({
              category,
              count: memories.length,
              contentPreview: consolidatedContent.substring(0, 100) + '...'
            });

            // Update category visualization if available
            if (visualizationContext && categoryNodeId) {
              try {
                visualizationContext.visualizer.updateNode(
                  visualizationContext.visualization,
                  categoryNodeId,
                  {
                    status: 'completed',
                    data: {
                      category,
                      memoryCount: memories.length,
                      newMemoryId: consolidatedMemory.id,
                      contentPreview: consolidatedContent.substring(0, 100) + '...',
                      timestamp: Date.now()
                    }
                  }
                );
              } catch (error) {
                console.error(`Error updating category consolidation visualization for ${category}:`, error);
              }
            }

            // Optionally delete source memories
            if (this._config.forgetSourceMemoriesAfterConsolidation) {
              await Promise.all(
                memories.map(memory => this.deleteMemory(memory.id))
              );
              
              // Create forget visualization node if enabled
              if (visualizationContext && 
                  visualizationContext.visualization && 
                  visualizationContext.visualizer && 
                  categoryNodeId) {
                try {
                  const forgetNodeId = visualizationContext.visualizer.addNode(
                    visualizationContext.visualization,
                    'memory_forget',
                    `Forgetting Source ${category} Memories`,
                    {
                      category,
                      memoriesRemoved: memories.length,
                      timestamp: Date.now()
                    },
                    'completed'
                  );
                  
                  // Connect to category node
                  if (forgetNodeId) {
                    visualizationContext.visualizer.addEdge(
                      visualizationContext.visualization,
                      categoryNodeId,
                      forgetNodeId,
                      'forgets_sources'
                    );
                  }
                } catch (error) {
                  console.error(`Error creating forget visualization for ${category}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`Error consolidating memories in category ${category}:`, error);
            
            // Update category visualization with error if available
            if (visualizationContext && categoryNodeId) {
              try {
                visualizationContext.visualizer.updateNode(
                  visualizationContext.visualization,
                  categoryNodeId,
                  {
                    status: 'error',
                    data: {
                      error: error instanceof Error ? error.message : String(error),
                      timestamp: Date.now()
                    }
                  }
                );
              } catch (vizError) {
                console.error(`Error updating category visualization with error for ${category}:`, vizError);
              }
            }
          }
        }
      }

      const result = {
        success: true,
        consolidatedCount,
        message: `Consolidated ${consolidatedCount} groups of memories`
      };
      
      // Update visualization with final results
      if (visualizationContext && consolidationNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            consolidationNodeId,
            {
              status: 'completed',
              data: {
                success: true,
                consolidatedCount,
                consolidatedGroups,
                timestamp: Date.now()
              }
            }
          );
          
          // Create a summary result node
          const summaryNodeId = visualizationContext.visualizer.addNode(
            visualizationContext.visualization,
            'consolidation_summary',
            `Memory Consolidation Summary`,
            {
              consolidatedCount,
              categories: consolidatedGroups.map(g => g.category),
              timestamp: Date.now()
            },
            'completed'
          );
          
          // Connect summary to consolidation node
          if (summaryNodeId) {
            visualizationContext.visualizer.addEdge(
              visualizationContext.visualization,
              consolidationNodeId,
              summaryNodeId,
              'summarizes'
            );
          }
        } catch (error) {
          console.error('Error updating memory consolidation visualization with result:', error);
        }
      }
      
      return result;
    } catch (error) {
      // Update visualization with error if available
      if (visualizationContext && consolidationNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            consolidationNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now()
              }
            }
          );
        } catch (vizError) {
          console.error('Error updating memory consolidation visualization with error:', vizError);
        }
      }
      
      return {
        success: false,
        consolidatedCount: 0,
        message: `Error during memory consolidation: ${(error as Error).message}`
      };
    }
  }

  // #endregion Memory Maintenance

  /**
   * Retrieve memories relevant to a query with visualization support
   * @param query The query to search for
   * @param options Options for memory retrieval including visualization context
   * @returns Array of relevant memories
   */
  async retrieveRelevantMemories(
    query: string,
    options: {
      limit?: number;
      types?: string[];
      tags?: string[];
      minRelevance?: number;
      includeCritical?: boolean;
      visualization?: any;
      visualizer?: any;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      // Create visualization node if visualization is enabled
      const visualization = options.visualization;
      const visualizer = options.visualizer;
      let retrievalNodeId: string | undefined;
      
      if (visualization && visualizer) {
        try {
          retrievalNodeId = visualizer.addNode(
            visualization,
            'context_retrieval', // VisualizationNodeType.CONTEXT_RETRIEVAL
            'Memory Retrieval',
            {
              query,
              types: options.types || [],
              tags: options.tags || [],
              timestamp: Date.now()
            },
            'in_progress'
          );
        } catch (error) {
          console.error('Error creating memory retrieval visualization node:', error);
        }
      }
      
      // Perform the memory search
      const searchOptions: MemorySearchOptions = {
        limit: options.limit || 10,
        metadata: {} as Record<string, any>
      };
      
      // Add type filter if specified
      if (options.types && options.types.length > 0) {
        searchOptions.metadata = searchOptions.metadata || {};
        searchOptions.metadata['type'] = options.types;
      }
      
      // Add tag filter if specified
      if (options.tags && options.tags.length > 0) {
        searchOptions.metadata = searchOptions.metadata || {};
        searchOptions.metadata['tags'] = options.tags;
      }
      
      // Get memories
      const memories = await this.searchMemories(query, searchOptions);
      
      // Update visualization node if created
      if (visualization && visualizer && retrievalNodeId) {
        try {
          // Find the retrieval node
          const retrievalNode = visualization.nodes.find(
            (node: { id: string }) => node.id === retrievalNodeId
          );
          
          if (retrievalNode) {
            // Create array of unique memory types
            const memoryTypes: string[] = [];
            memories.forEach(m => {
              const type = m.metadata?.type as string || 'unknown';
              if (!memoryTypes.includes(type)) {
                memoryTypes.push(type);
              }
            });
            
            // Update with results
            retrievalNode.status = 'completed';
            retrievalNode.data = {
              ...retrievalNode.data,
              resultCount: memories.length,
              memoryTypes,
              memoryIds: memories.map(m => m.id)
            };
            
            // Add end time and duration to metrics
            if (retrievalNode.metrics) {
              retrievalNode.metrics.endTime = Date.now();
              retrievalNode.metrics.duration = 
                retrievalNode.metrics.endTime - (retrievalNode.metrics.startTime || Date.now());
            }
          }
        } catch (error) {
          console.error('Error updating memory retrieval visualization node:', error);
        }
      }
      
      return memories;
    } catch (error) {
      console.error('Error retrieving relevant memories:', error);
      
      // Update visualization with error if enabled
      if (options.visualization && options.visualizer) {
        try {
          options.visualizer.addNode(
            options.visualization,
            'error', // VisualizationNodeType.ERROR
            'Memory Retrieval Error',
            {
              error: error instanceof Error ? error.message : String(error),
              query
            },
            'error'
          );
        } catch (visualizationError) {
          console.error('Error updating visualization with error:', visualizationError);
        }
      }
      
      return [];
    }
  }

  /**
   * Generate a request ID for tracking operations
   */
  private generateRequestId(): string {
    return ulid();
  }

  /**
   * Get direct access to the memory client for specialized operations
   */
  async getMemoryClient(): Promise<any> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    try {
      // Get the memory service
      const memoryService = await this.getMemoryService();
      if (!memoryService) {
        console.error('Memory service not available');
        return null;
      }
      
      // Return the service itself as it might have the methods needed
      return memoryService;
    } catch (error) {
      console.error('Error getting memory client:', error);
      return null;
    }
  }

  /**
   * Get tasks by status directly from memory
   */
  async getTasksByStatus(
    statuses: string[] = ['pending', 'scheduled', 'in_progress']
  ): Promise<any[]> {
    try {
      // Get memory service
      const memoryService = await this.getMemoryService();
      if (!memoryService) {
        console.error('Memory service not available for task retrieval');
        return [];
      }
      
      // Use searchMemories method
      const filter = {
        type: 'task',
        status: { $in: statuses }
      };
      
      if (typeof memoryService.searchMemories === 'function') {
        try {
          const searchResult = await memoryService.searchMemories({
            type: 'task',
            filter: filter,
            limit: 100
          });
          
          // Format results to match task structure
          if (searchResult?.success && Array.isArray(searchResult.data)) {
            return searchResult.data.map(item => {
              const metadata = item.metadata || {};
              return {
                id: item.id || '',
                title: metadata.title || '',
                description: metadata.description || '',
                type: metadata.type || 'task',
                status: metadata.status || 'pending',
                priority: metadata.priority || 0,
                retryAttempts: metadata.retryAttempts || 0,
                dependencies: metadata.dependencies || [],
                metadata: metadata,
                createdAt: metadata.createdAt || item.createdAt || new Date().toISOString(),
                updatedAt: metadata.updatedAt || item.updatedAt || new Date().toISOString()
              };
            });
          }
        } catch (searchError) {
          console.error('Error using searchMemories:', searchError);
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      return [];
    }
  }
} 