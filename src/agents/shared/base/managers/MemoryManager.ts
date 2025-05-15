/**
 * Memory Manager Interface
 * 
 * This file defines the memory manager interface that provides memory services
 * for agents. It extends the base manager interface with memory-specific functionality.
 */

import { BaseManager, AbstractBaseManager, ManagerConfig } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { 
  ConversationSummarizer,
  ConversationSummaryOptions,
  ConversationSummaryResult
} from '../../memory/interfaces/ConversationSummarization.interface';
import { ManagerType } from './ManagerType';

/**
 * Memory entry interface
 */
export interface MemoryEntry {
  id: string;
  content: string;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'relevance' | 'createdAt' | 'lastAccessedAt' | 'accessCount';
  sortDirection?: 'asc' | 'desc';
  metadata?: Record<string, unknown>;
}

/**
 * Memory consolidation result
 */
export interface MemoryConsolidationResult {
  success: boolean;
  consolidatedCount: number;
  message: string;
}

/**
 * Memory pruning result
 */
export interface MemoryPruningResult {
  success: boolean;
  prunedCount: number;
  message: string;
}

/**
 * Configuration options for memory managers
 */
export interface MemoryManagerConfig extends ManagerConfig {
  enabled: boolean;
  enableAutoPruning?: boolean;
  pruningIntervalMs?: number;
  maxShortTermEntries?: number;
  relevanceThreshold?: number;
  enableAutoConsolidation?: boolean;
  consolidationIntervalMs?: number;
  minMemoriesForConsolidation?: number;
  forgetSourceMemoriesAfterConsolidation?: boolean;
  enableMemoryInjection?: boolean;
  maxInjectedMemories?: number;
  
  /* Configuration related to conversation summarization */
  enableConversationSummarization?: boolean;
  defaultSummaryLength?: number;
  defaultSummaryDetailLevel?: 'brief' | 'standard' | 'detailed';
  extractTopicsFromConversations?: boolean;
  extractActionItemsFromConversations?: boolean;
  defaultMaxEntriesForSummarization?: number;
}

/**
 * Memory manager interface
 */
export interface MemoryManager extends BaseManager, ConversationSummarizer {
  /**
   * Add memory content
   * @param content Memory content to store
   * @param metadata Additional metadata
   * @returns Promise resolving to the stored memory
   */
  addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry>;
  
  /**
   * Search memories
   * @param query Query string
   * @param options Search options
   * @returns Promise resolving to matching memories
   */
  searchMemories(query: string, options: MemorySearchOptions): Promise<MemoryEntry[]>;
  
  /**
   * Get recent memories
   * @param limit Maximum number of memories to retrieve
   * @returns Promise resolving to recent memories
   */
  getRecentMemories(limit: number): Promise<MemoryEntry[]>;
  
  /**
   * Consolidate memories
   * @returns Promise resolving when consolidation is complete
   */
  consolidateMemories(): Promise<MemoryConsolidationResult>;
  
  /**
   * Prune memories
   * @returns Promise resolving when pruning is complete
   */
  pruneMemories(): Promise<MemoryPruningResult>;
}

/**
 * Abstract base memory manager class
 */
export abstract class AbstractMemoryManager extends AbstractBaseManager implements MemoryManager {
  protected agent: AgentBase;
  protected memoryService: any = null;
  protected searchService: any = null;
  protected memoryPruningTimer: NodeJS.Timeout | null = null;
  protected memoryConsolidationTimer: NodeJS.Timeout | null = null;
  
  constructor(agent: AgentBase, config: MemoryManagerConfig) {
    super(`${agent.getAgentId()}-memory-manager`, ManagerType.MEMORY, agent, {
      // Default memory manager configuration
      enableAutoPruning: true,
      pruningIntervalMs: 300000, // 5 minutes
      maxShortTermEntries: 100,
      relevanceThreshold: 0.2,
      enableAutoConsolidation: true,
      consolidationIntervalMs: 600000, // 10 minutes
      minMemoriesForConsolidation: 5,
      forgetSourceMemoriesAfterConsolidation: false,
      enableMemoryInjection: true,
      maxInjectedMemories: 5,
      
      // Conversation summarization defaults
      enableConversationSummarization: true,
      defaultSummaryLength: 500,
      defaultSummaryDetailLevel: 'standard',
      extractTopicsFromConversations: true,
      extractActionItemsFromConversations: true,
      defaultMaxEntriesForSummarization: 20,
      
      ...config
    });
    
    this.agent = agent;
  }
  
  async initialize(): Promise<boolean> {
    try {
      // Initialize memory services if running server-side
      if (typeof window === 'undefined') {
        // Import dynamically to avoid circular dependencies
        const { getMemoryServices } = await import('../../../../server/memory/services');
        const services = await getMemoryServices();
        this.memoryService = services.memoryService;
        this.searchService = services.searchService;
        
        console.log(`[${this.managerId}] Memory services initialized`);
        
        // Setup memory pruning if enabled
        if (this._config.enableAutoPruning) {
          this.setupMemoryPruning();
        }
        
        // Setup memory consolidation if enabled
        if (this._config.enableAutoConsolidation) {
          this.setupMemoryConsolidation();
        }
        
        this._initialized = true;
        return true;
      }
      
      // Client-side initialization (limited functionality)
      console.log(`[${this.managerId}] Running in client mode with limited functionality`);
      this._initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Error initializing memory manager:`, error);
      return false;
    }
  }
  
  async shutdown(): Promise<void> {
    // Cancel scheduled memory pruning
    if (this.memoryPruningTimer) {
      clearInterval(this.memoryPruningTimer);
      this.memoryPruningTimer = null;
    }
    
    // Cancel scheduled memory consolidation
    if (this.memoryConsolidationTimer) {
      clearInterval(this.memoryConsolidationTimer);
      this.memoryConsolidationTimer = null;
    }
    
    // Run final memory operations before shutdown
    if (this._initialized && this.memoryService) {
      await this.pruneMemories();
      await this.consolidateMemories();
    }
    
    this._initialized = false;
  }
  
  /**
   * Set up automatic memory pruning
   */
  protected setupMemoryPruning(): void {
    const interval = (this._config as MemoryManagerConfig).pruningIntervalMs || 3600000; // Default: 1 hour
    
    // Clear any existing timer
    if (this.memoryPruningTimer) {
      clearInterval(this.memoryPruningTimer);
    }
    
    // Set up new timer
    this.memoryPruningTimer = setInterval(() => {
      this.pruneMemories().catch(error => {
        console.error(`[${this.managerId}] Error during automatic memory pruning:`, error);
      });
    }, interval);
    
    console.log(`[${this.managerId}] Set up memory pruning with interval ${interval}ms`);
  }

  /**
   * Set up automatic memory consolidation
   */
  protected setupMemoryConsolidation(): void {
    const interval = (this._config as MemoryManagerConfig).consolidationIntervalMs || 7200000; // Default: 2 hours
    
    // Clear any existing timer
    if (this.memoryConsolidationTimer) {
      clearInterval(this.memoryConsolidationTimer);
    }
    
    // Set up new timer
    this.memoryConsolidationTimer = setInterval(() => {
      this.consolidateMemories().catch(error => {
        console.error(`[${this.managerId}] Error during automatic memory consolidation:`, error);
      });
    }, interval);
    
    console.log(`[${this.managerId}] Set up memory consolidation with interval ${interval}ms`);
  }

  abstract addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry>;
  abstract searchMemories(query: string, options: MemorySearchOptions): Promise<MemoryEntry[]>;
  abstract getRecentMemories(limit: number): Promise<MemoryEntry[]>;
  abstract consolidateMemories(): Promise<MemoryConsolidationResult>;
  abstract pruneMemories(): Promise<MemoryPruningResult>;
  abstract summarizeConversation(options?: ConversationSummaryOptions): Promise<ConversationSummaryResult>;
  abstract summarizeMultipleConversations(
    conversationIds: string[],
    options?: ConversationSummaryOptions
  ): Promise<Record<string, ConversationSummaryResult>>;
  abstract getConversationTopics(
    conversationId: string,
    options?: { maxTopics?: number; minConfidence?: number }
  ): Promise<string[]>;
  abstract extractActionItems(
    conversationId: string,
    options?: { maxItems?: number; minConfidence?: number }
  ): Promise<string[]>;
} 