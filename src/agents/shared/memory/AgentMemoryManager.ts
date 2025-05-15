/**
 * AgentMemoryManager.ts - Agent-scoped memory management
 * 
 * This module provides an implementation of the MemoryManager interface
 * with agent-scoped memory access using the MemoryIsolationManager.
 */

import { v4 as uuidv4 } from 'uuid';
import { AbstractBaseManager } from '../base/managers/BaseManager';
import { 
  MemoryManager, 
  MemoryEntry,
  MemoryManagerConfig,
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult
} from '../base/managers/MemoryManager.interface';
import { AgentBase } from '../base/AgentBase.interface';
import { 
  MemoryIsolationManager, 
  DEFAULT_MEMORY_ISOLATION_CONFIG,
  MemoryIsolationConfig
} from './MemoryIsolationManager';
import {
  MemoryScope,
  MemoryAccessLevel,
  MemoryPermission,
  createReadOnlyPermissionSet,
  createReadWritePermissionSet,
  createFullPermissionSet
} from './MemoryScope';
import { ManagerType } from '../base/managers/ManagerType';
import { ManagerHealth } from '../base/managers/ManagerHealth';
import { 
  ConversationSummarizer,
  ConversationSummaryOptions,
  ConversationSummaryResult 
} from './interfaces/ConversationSummarization.interface';
import { DefaultConversationSummarizer } from './summarization/DefaultConversationSummarizer';

/**
 * Extended memory manager configuration with isolation options
 */
export interface AgentMemoryManagerConfig extends MemoryManagerConfig {
  /**
   * Isolation-specific configuration
   */
  isolation?: Partial<MemoryIsolationConfig>;
  
  /**
   * Default scope name for the agent
   */
  defaultScopeName?: string;
  
  /**
   * Whether to create a private scope for the agent
   */
  createPrivateScope?: boolean;
  
  /**
   * Memory types allowed in the agent's scopes
   */
  allowedMemoryTypes?: string[];
  
  /**
   * Add any additional config properties here
   */
  maxMessageHistory?: number;
  enableMonitoring?: boolean;
  enableEncryption?: boolean;
}

/**
 * Default memory manager configuration
 */
export const DEFAULT_AGENT_MEMORY_MANAGER_CONFIG: AgentMemoryManagerConfig = {
  enabled: true,
  enableAutoPruning: true,
  pruningIntervalMs: 1000 * 60 * 60, // 1 hour
  maxShortTermEntries: 1000,
  relevanceThreshold: 0.7,
  enableAutoConsolidation: true,
  consolidationIntervalMs: 1000 * 60 * 60 * 24, // 1 day
  minMemoriesForConsolidation: 50,
  forgetSourceMemoriesAfterConsolidation: false,
  enableMemoryInjection: true,
  maxInjectedMemories: 5,
  createPrivateScope: true,
  defaultScopeName: 'private'
};

/**
 * Agent memory manager implementation with isolation capabilities
 */
export class AgentMemoryManager extends AbstractBaseManager implements MemoryManager {
  protected _initialized = false;
  private memoryStore: Map<string, MemoryEntry> = new Map();
  
  /**
   * Memory isolation manager
   */
  private isolationManager: MemoryIsolationManager;
  
  /**
   * Agent-specific private scope ID
   */
  private privateScope?: MemoryScope;
  
  /**
   * Default shared scope for cross-agent communication
   */
  private sharedScope?: MemoryScope;
  
  /**
   * Configuration
   */
  protected config: AgentMemoryManagerConfig;
  
  private conversationSummarizer: ConversationSummarizer;
  
  /**
   * Creates a new agent memory manager
   * @param agent The agent this manager belongs to
   * @param config Configuration options
   */
  constructor(agent: AgentBase, config: Partial<AgentMemoryManagerConfig> = { enabled: true }) {
    super(`memory-manager-${uuidv4()}`, ManagerType.MEMORY, agent, { enabled: true, ...config });
    
    // Merge defaults with provided config
    this.config = {
      ...DEFAULT_AGENT_MEMORY_MANAGER_CONFIG,
      ...config
    };
    
    // Create isolation manager
    this.isolationManager = new MemoryIsolationManager(
      this.config.isolation || DEFAULT_MEMORY_ISOLATION_CONFIG
    );
    
    this.conversationSummarizer = new DefaultConversationSummarizer();
  }
  
  /**
   * Sets the initialization status
   * @param initialized Whether the manager is initialized
   */
  protected setInitialized(initialized: boolean): void {
    this._initialized = initialized;
  }
  
  /**
   * Initializes the memory manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }

    try {
      console.log(`Initializing AgentMemoryManager for agent ${this.getAgent().getAgentId()}`);
      
      // Create private scope for the agent if enabled
      if (this.config.createPrivateScope) {
        this.privateScope = this.isolationManager.createScope({
          name: this.config.defaultScopeName || 'private',
          description: `Private memory space for agent ${this.getAgent().getAgentId()}`,
          accessLevel: MemoryAccessLevel.PRIVATE,
          ownerAgentId: this.getAgent().getAgentId(),
          allowedMemoryTypes: this.config.allowedMemoryTypes
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
      
      // Initialize memory store
      this.memoryStore.clear();
      this._initialized = true;
      return true;
    } catch (error) {
      this._initialized = false;
      console.error('Error initializing AgentMemoryManager:', error);
      return false;
    }
  }
  
  /**
   * Implements memory operations with agent scoping and isolation
   */
  
  /**
   * Adds a memory with proper agent scoping
   * @param content Memory content
   * @param metadata Additional metadata
   * @returns The added memory
   */
  async addMemory(content: string, metadata: Record<string, unknown> = {}): Promise<MemoryEntry> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // Determine scope
    const scopeId = this.getScopeId(metadata.scopeId as string);
    if (!scopeId) {
      throw new Error('No valid memory scope available');
    }
    
    // Create a simple memory object for demonstration purposes
    const memoryId = `mem_${uuidv4()}`;
    const memory: MemoryEntry = {
      id: memoryId,
      content,
      metadata: {
        agentId: this.getAgent().getAgentId(),
        scopeId,
        ...metadata
      },
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };
    
    // In a real implementation, this would call isolationManager.addMemory()
    console.log(`Added memory ${memoryId} for agent ${this.getAgent().getAgentId()} in scope ${scopeId}`);
    
    this.memoryStore.set(memory.id, memory);
    return memory;
  }
  
  /**
   * Searches for memories with proper agent scoping
   * @param query Search query
   * @param options Search options
   * @returns Matching memories
   */
  async searchMemories(query: string, options: Record<string, unknown> = {}): Promise<MemoryEntry[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // Determine scope
    const scopeId = this.getScopeId(options.scopeId as string);
    if (!scopeId) {
      return [];
    }
    
    // For now, since MemoryIsolationManager doesn't have a real implementation yet,
    // we'll return an empty array for demonstration purposes
    // In a real implementation, this would call isolationManager.getRelevantMemories()
    console.log(`Searching memories for agent ${this.getAgent().getAgentId()} in scope ${scopeId} with query: ${query}`);
    
    // Simple search implementation
    const searchResults: MemoryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    const memories = Array.from(this.memoryStore.values());
    for (const memory of memories) {
      if (typeof memory.content === 'string' && memory.content.toLowerCase().includes(lowerQuery)) {
        searchResults.push(memory);
      }
    }

    return searchResults;
  }
  
  /**
   * Searches across all accessible scopes
   * @param query Search query
   * @param options Search options
   * @returns Matching memories from all accessible scopes
   */
  async searchAllScopes(query: string, options: Record<string, unknown> = {}): Promise<unknown[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // Get all accessible scopes
    const scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
    
    // Search in each scope
    const allResults: unknown[] = [];
    for (const scope of scopes) {
      const scopeId = scope.scopeId.id;
      
      // For now, we'll just log the search since the implementation is not real
      console.log(`Searching memories for agent ${this.getAgent().getAgentId()} in scope ${scopeId} with query: ${query}`);
      
      // In a real implementation, this would use actual search results
      // const scopeResults = await this.isolationManager.getRelevantMemories(...)
      const scopeResults: Record<string, unknown>[] = [];
      
      // Add scope identifier to each result
      const resultsWithScope = scopeResults.map((result: Record<string, unknown>) => ({
        ...result,
        scopeId,
        scopeName: scope.scopeId.name
      }));
      
      // Add to all results
      allResults.push(...resultsWithScope);
    }
    
    // Sort results by relevance
    // In a real implementation, we would re-rank results here
    
    return allResults;
  }
  
  /**
   * Gets recent memories
   * @param limit Maximum number of memories to return
   * @param options Additional options
   * @returns Recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<MemoryEntry[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // Determine scope
    const scopeId = this.getScopeId();
    if (!scopeId) {
      return [];
    }
    
    // For now, since MemoryIsolationManager doesn't have a real implementation yet,
    // we'll return an empty array for demonstration purposes
    console.log(`Getting recent memories for agent ${this.getAgent().getAgentId()} in scope ${scopeId} with limit: ${limit}`);
    
    return [];
  }
  
  /**
   * Consolidates memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would implement memory consolidation logic
    console.log(`Consolidating memories for agent ${this.getAgent().getAgentId()}`);
    
    return {
      success: true,
      consolidatedCount: 0,
      message: 'Memory consolidation completed'
    };
  }
  
  /**
   * Prunes memories
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would implement memory pruning logic
    console.log(`Pruning memories for agent ${this.getAgent().getAgentId()}`);
    
    return {
      success: true,
      prunedCount: 0,
      message: 'Memory pruning completed'
    };
  }
  
  /**
   * Memory sharing operations
   */
  
  /**
   * Shares memories with another agent
   * @param targetAgentId Target agent ID
   * @param options Sharing options
   * @returns Whether the sharing request was created
   */
  async shareMemories(
    targetAgentId: string, 
    options: {
      scopeId?: string;
      memoryIds?: string[];
      permissions?: string[];
      requireApproval?: boolean;
    } = {}
  ): Promise<Record<string, unknown>> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // Determine scope
    const scopeId = this.getScopeId(options.scopeId);
    if (!scopeId) {
      throw new Error('No valid memory scope available');
    }
    
    // Convert permission strings to MemoryPermissionSet
    const permissionSet = new Set<MemoryPermission>();
    if (options.permissions) {
      for (const permission of options.permissions) {
        switch (permission) {
          case 'read':
            permissionSet.add(MemoryPermission.READ);
            break;
          case 'write':
            permissionSet.add(MemoryPermission.WRITE);
            break;
          case 'update':
            permissionSet.add(MemoryPermission.UPDATE);
            break;
          case 'delete':
            permissionSet.add(MemoryPermission.DELETE);
            break;
          case 'share':
            permissionSet.add(MemoryPermission.SHARE);
            break;
        }
      }
    } else {
      // Default to read-only
      permissionSet.add(MemoryPermission.READ);
    }
    
    // Create sharing request
    const request = this.isolationManager.createSharingRequest(
      this.getAgent().getAgentId(),
      targetAgentId,
      scopeId,
      permissionSet,
      options.memoryIds
    );
    
    if (!request) {
      throw new Error(`Failed to create sharing request for scope ${scopeId} to agent ${targetAgentId}`);
    }
    
    // If approval is not required, automatically approve
    if (options.requireApproval === false) {
      this.isolationManager.respondToSharingRequest(request.requestId, true);
    }
    
    // Convert to Record<string, unknown> to match the return type
    return {
      requestId: request.requestId,
      requestingAgentId: request.requestingAgentId,
      targetAgentId: request.targetAgentId,
      scopeId: request.scopeId,
      memoryIds: request.memoryIds,
      status: request.status,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt
    };
  }
  
  /**
   * Responds to a memory sharing request
   * @param requestId Request ID
   * @param approved Whether to approve the request
   * @param reason Optional reason for the response
   * @returns Whether the response was processed
   */
  async respondToSharingRequest(
    requestId: string,
    approved: boolean,
    reason?: string
  ): Promise<boolean> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    return this.isolationManager.respondToSharingRequest(requestId, approved, reason);
  }
  
  /**
   * Gets pending sharing requests for this agent
   * @returns Pending sharing requests
   */
  async getPendingSharingRequests(): Promise<unknown[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    return this.isolationManager.getPendingSharingRequests(this.getAgent().getAgentId());
  }
  
  /**
   * Gets all accessible memory scopes for this agent
   * @returns Accessible memory scopes
   */
  async getAccessibleScopes(): Promise<unknown[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    const scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
    
    // Return simplified scope info
    return scopes.map(scope => ({
      id: scope.scopeId.id,
      name: scope.scopeId.name,
      description: scope.scopeId.description,
      accessLevel: scope.accessPolicy.accessLevel,
      owner: scope.accessPolicy.ownerAgentId,
      isOwner: scope.accessPolicy.ownerAgentId === this.getAgent().getAgentId()
    }));
  }
  
  /**
   * Shutdown the memory manager
   */
  async shutdown(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    try {
      console.log(`Shutting down memory manager for agent ${this.getAgent().getAgentId()}`);
      this.setInitialized(false);
      
      // Clear memory store
      this.memoryStore.clear();
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Utility methods
   */
  
  /**
   * Gets a valid scope ID
   * @param scopeId Requested scope ID
   * @returns A valid scope ID, or undefined if none is available
   */
  private getScopeId(scopeId?: string): string | undefined {
    // If a specific scope was requested, use it if valid
    if (scopeId) {
      const scope = this.isolationManager.getScope(scopeId);
      if (scope) {
        return scopeId;
      }
    }
    
    // Otherwise, use the private scope if available
    if (this.privateScope) {
      return this.privateScope.scopeId.id;
    }
    
    // Or the shared scope if available
    if (this.sharedScope) {
      return this.sharedScope.scopeId.id;
    }
    
    // No valid scope available
    return undefined;
  }
  
  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const isInitialized = this._initialized;
    const isEnabled = this.isEnabled();
    
    return {
      status: isInitialized && isEnabled ? 'healthy' : 'unhealthy',
      details: {
        lastCheck: new Date(),
        issues: isInitialized && isEnabled ? [] : [{
          severity: 'high',
          message: isInitialized ? 'Memory manager is disabled' : 'Memory manager is not initialized',
          detectedAt: new Date()
        }],
        metrics: {
          memoryCount: this.memoryStore.size,
          averageMemoryAge: this.getAverageMemoryAge()
        }
      }
    };
  }
  
  /**
   * Calculate average age of memories in milliseconds
   */
  private getAverageMemoryAge(): number {
    if (this.memoryStore.size === 0) return 0;
    
    const now = Date.now();
    let totalAge = 0;
    
    this.memoryStore.forEach(memory => {
      totalAge += now - memory.createdAt.getTime();
    });
    
    return totalAge / this.memoryStore.size;
  }
  
  /**
   * Reset the memory manager
   */
  async reset(): Promise<boolean> {
    try {
      // Reinitialize the manager
      await this.shutdown();
      return this.initialize();
    } catch (error) {
      console.error('Error resetting memory manager:', error);
      return false;
    }
  }

  /**
   * Summarize a conversation
   */
  async summarizeConversation(options?: ConversationSummaryOptions): Promise<ConversationSummaryResult> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would call the conversation summarizer
    console.log(`Summarizing conversation for agent ${this.getAgent().getAgentId()}`);
    
    return {
      summary: 'Basic conversation summary',
      success: true,
      stats: {
        messageCount: 0,
        userMessageCount: 0,
        agentMessageCount: 0,
        systemMessageCount: 0
      }
    };
  }

  /**
   * Summarize multiple conversations
   */
  async summarizeMultipleConversations(
    conversationIds: string[],
    options?: ConversationSummaryOptions
  ): Promise<Record<string, ConversationSummaryResult>> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would call the conversation summarizer
    console.log(`Summarizing multiple conversations for agent ${this.getAgent().getAgentId()}`);
    
    const results: Record<string, ConversationSummaryResult> = {};
    
    for (const id of conversationIds) {
      results[id] = {
        summary: `Basic summary for conversation ${id}`,
        success: true,
        stats: {
          messageCount: 0,
          userMessageCount: 0,
          agentMessageCount: 0,
          systemMessageCount: 0
        }
      };
    }
    
    return results;
  }

  /**
   * Get conversation topics
   */
  async getConversationTopics(
    conversationId: string,
    options?: { maxTopics?: number; minConfidence?: number }
  ): Promise<string[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would analyze conversation content
    return ['topic1', 'topic2'];
  }

  /**
   * Extract action items from conversation
   */
  async extractActionItems(
    conversationId: string,
    options?: { maxItems?: number; minConfidence?: number }
  ): Promise<string[]> {
    if (!this._initialized) {
      throw new Error('Memory manager not initialized');
    }
    
    if (!this.isEnabled()) {
      throw new Error('Memory manager is disabled');
    }
    
    // In a real implementation, this would analyze conversation content
    return ['action1', 'action2'];
  }
} 