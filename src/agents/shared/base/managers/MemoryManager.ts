/**
 * Memory Manager Interface
 * 
 * This file defines the memory manager interface that provides memory services
 * for agents. It extends the base manager interface with memory-specific functionality.
 */

import { BaseManager, AbstractBaseManager, ManagerConfig } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ConversationSummarizer } from '../../memory/interfaces/ConversationSummarization.interface';

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
  addMemory(content: string, metadata: any): Promise<any>;
  
  /**
   * Search memories
   * @param query Query string
   * @param options Search options
   * @returns Promise resolving to matching memories
   */
  searchMemories(query: string, options: any): Promise<any[]>;
  
  /**
   * Get recent memories
   * @param limit Maximum number of memories to retrieve
   * @returns Promise resolving to recent memories
   */
  getRecentMemories(limit: number): Promise<any[]>;
  
  /**
   * Consolidate memories
   * @returns Promise resolving when consolidation is complete
   */
  consolidateMemories(): Promise<void>;
  
  /**
   * Prune memories
   * @returns Promise resolving when pruning is complete
   */
  pruneMemories(): Promise<void>;
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
    super(`${agent.getAgentId()}-memory-manager`, 'memory', agent, {
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
        if (this.config.enableAutoPruning) {
          this.setupMemoryPruning();
        }
        
        // Setup memory consolidation if enabled
        if (this.config.enableAutoConsolidation) {
          this.setupMemoryConsolidation();
        }
        
        this.initialized = true;
        return true;
      }
      
      // Client-side initialization (limited functionality)
      console.log(`[${this.managerId}] Running in client mode with limited functionality`);
      this.initialized = true;
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
    if (this.initialized && this.memoryService) {
      await this.pruneMemories();
      await this.consolidateMemories();
    }
    
    this.initialized = false;
  }
  
  /**
   * Set up automatic memory pruning
   */
  protected setupMemoryPruning(): void {
    const interval = (this.config as MemoryManagerConfig).pruningIntervalMs || 3600000; // Default: 1 hour
    
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
    const interval = (this.config as MemoryManagerConfig).consolidationIntervalMs || 7200000; // Default: 2 hours
    
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
  
  /**
   * These methods must be implemented by concrete memory manager classes
   */
  abstract addMemory(content: string, metadata: any): Promise<any>;
  abstract searchMemories(query: string, options: any): Promise<any[]>;
  abstract getRecentMemories(limit: number): Promise<any[]>;
  abstract consolidateMemories(): Promise<void>;
  abstract pruneMemories(): Promise<void>;
  
  /**
   * ConversationSummarizer interface implementation
   * These methods must be implemented by concrete memory manager classes
   */
  abstract summarizeConversation(options?: any): Promise<any>;
  abstract summarizeMultipleConversations(conversationIds: string[], options?: any): Promise<any>;
  abstract getConversationTopics(conversationId: string, options?: any): Promise<string[]>;
  abstract extractActionItems(conversationId: string, options?: any): Promise<string[]>;
} 