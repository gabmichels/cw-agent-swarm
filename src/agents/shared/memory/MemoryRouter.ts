/**
 * MemoryRouter.ts - Routes memory operations with agent scoping
 * 
 * This module provides:
 * - Agent-scoped memory access
 * - Memory isolation between agents
 * - Shared memory access permissions
 * - Memory operation routing
 * - Enhanced memory retrieval with reranking and confidence thresholds
 */

import { RerankerService, RerankerResult } from './RerankerService';

// Base memory interfaces
export interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  category?: string;
  created: Date;
  source?: string;
  importance?: string;
  context?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface MemorySearchOptions {
  limit?: number;
  filter?: Record<string, any>;
  tags?: string[];
  importance?: string;
  source?: string;
  startDate?: Date;
  endDate?: Date;
}

// Memory router options
export interface MemoryRouterOptions {
  defaultNamespace?: string;
  enableSharedMemory?: boolean;
  enableAgentIsolation?: boolean;
  embeddingModel?: string;
  enableReranking?: boolean;
  confidenceThreshold?: number;
}

/**
 * Enhanced memory retrieval options
 */
export interface EnhancedMemoryRetrievalOptions {
  types?: string[];
  debug?: boolean;
  returnScores?: boolean;
  confidenceThreshold?: number;
  validateContent?: boolean;
  requireConfidence?: boolean;
}

/**
 * Enhanced memory retrieval result
 */
export interface EnhancedMemoryResult {
  entries: MemoryEntry[];
  hasConfidence: boolean;
  confidenceScore?: number;
  contentValid?: boolean;
  invalidReason?: string;
}

/**
 * Memory router for agent-scoped memory access
 */
export class MemoryRouter {
  private options: MemoryRouterOptions;
  private initialized: boolean = false;
  private agentMemoryMap: Map<string, Set<string>> = new Map();
  private rerankerService: RerankerService | null = null;
  
  constructor(options: MemoryRouterOptions = {}) {
    this.options = {
      defaultNamespace: 'shared',
      enableSharedMemory: true,
      enableAgentIsolation: true,
      embeddingModel: 'text-embedding-3-small',
      enableReranking: true,
      confidenceThreshold: 70,
      ...options
    };
    
    // Initialize reranker service for enhanced retrieval (server-side only)
    if (typeof window === 'undefined' && this.options.enableReranking) {
      this.rerankerService = new RerankerService({
        confidenceThreshold: this.options.confidenceThreshold
      });
    }
  }
  
  /**
   * Initialize the memory router
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing MemoryRouter...');
      
      // Initialization logic will be added here
      
      this.initialized = true;
      console.log('MemoryRouter initialized successfully');
    } catch (error) {
      console.error('Error initializing MemoryRouter:', error);
      throw error;
    }
  }
  
  /**
   * Register an agent with the memory router
   */
  registerAgent(agentId: string, memoryScopes: string[] = []): void {
    const scopes = new Set<string>(memoryScopes);
    // Always add agent's own scope
    scopes.add(agentId);
    
    this.agentMemoryMap.set(agentId, scopes);
    console.log(`Agent ${agentId} registered with memory scopes: ${Array.from(scopes).join(', ')}`);
  }
  
  /**
   * Check if an agent has access to a memory scope
   */
  hasMemoryAccess(agentId: string, scope: string): boolean {
    // Shared memory is accessible by all agents if enabled
    if (scope === this.options.defaultNamespace && this.options.enableSharedMemory) {
      return true;
    }
    
    // Check if agent has been registered
    const agentScopes = this.agentMemoryMap.get(agentId);
    if (!agentScopes) {
      console.warn(`Agent ${agentId} not registered with memory router`);
      return false;
    }
    
    // Check if agent has access to the requested scope
    return agentScopes.has(scope);
  }
  
  /**
   * Add a memory with proper agent scoping
   */
  async addMemory(
    agentId: string,
    scope: string,
    content: string,
    type: string,
    metadata: Record<string, any> = {}
  ): Promise<MemoryEntry | null> {
    if (!this.hasMemoryAccess(agentId, scope)) {
      console.warn(`Agent ${agentId} does not have access to memory scope ${scope}`);
      return null;
    }
    
    // Memory addition logic will be implemented here
    
    const memoryEntry: MemoryEntry = {
      id: `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      content,
      type,
      created: new Date(),
      ...metadata
    };
    
    console.log(`Added memory for agent ${agentId} in scope ${scope}: ${content.substring(0, 50)}...`);
    return memoryEntry;
  }
  
  /**
   * Get relevant memories for an agent with proper scoping
   */
  async getRelevantMemories(
    agentId: string,
    scope: string,
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryEntry[]> {
    if (!this.hasMemoryAccess(agentId, scope)) {
      console.warn(`Agent ${agentId} does not have access to memory scope ${scope}`);
      return [];
    }
    
    // Memory retrieval logic will be implemented here
    
    // Placeholder return
    return [];
  }
  
  /**
   * Get enhanced relevant memories with reranking and confidence thresholds
   * @param agentId The ID of the agent making the request
   * @param scope The memory scope to search in
   * @param query The search query
   * @param candidateLimit Number of candidates to retrieve in the first stage
   * @param finalLimit Number of final results to return
   * @param options Enhanced retrieval options
   * @returns Enhanced retrieval result with confidence information
   */
  async getEnhancedRelevantMemories(
    agentId: string,
    scope: string,
    query: string,
    candidateLimit: number = 15,
    finalLimit: number = 5,
    options: EnhancedMemoryRetrievalOptions = {}
  ): Promise<EnhancedMemoryResult> {
    if (!this.hasMemoryAccess(agentId, scope)) {
      console.warn(`Agent ${agentId} does not have access to memory scope ${scope}`);
      return {
        entries: [],
        hasConfidence: false
      };
    }
    
    try {
      // Step 1: Get a broader set of candidates using vector search
      const candidates = await this.getRelevantMemories(
        agentId,
        scope,
        query,
        {
          limit: candidateLimit,
          tags: options.types
        }
      );
      
      // If reranking is not enabled or we don't have the reranker, return as is
      if (!this.options.enableReranking || !this.rerankerService) {
        return {
          entries: candidates.slice(0, finalLimit),
          hasConfidence: false
        };
      }
      
      // Step 2: Rerank the candidates with confidence threshold and validation
      const rerankedResult = await this.rerankerService.rerankWithConfidence(
        query, 
        candidates, 
        {
          debug: options.debug,
          returnScores: options.returnScores || true,
          confidenceThreshold: options.confidenceThreshold || this.options.confidenceThreshold,
          validateContent: options.validateContent || true
        }
      );
      
      // If caller requires confidence and it wasn't met, return empty results
      if (options.requireConfidence === true && !rerankedResult.confidenceThresholdMet) {
        return {
          entries: [],
          hasConfidence: false,
          confidenceScore: rerankedResult.topScore
        };
      }
      
      // Extract validation result if available
      let contentValid: boolean | undefined;
      let invalidReason: string | undefined;
      
      if (rerankedResult.validationResult) {
        contentValid = rerankedResult.validationResult.isValid;
        invalidReason = rerankedResult.validationResult.reason;
      }
      
      // Return the top results with confidence information
      return {
        entries: rerankedResult.entries.slice(0, finalLimit),
        hasConfidence: rerankedResult.confidenceThresholdMet,
        confidenceScore: rerankedResult.topScore,
        contentValid,
        invalidReason
      };
    } catch (error) {
      console.error('Error in enhanced memory retrieval:', error);
      
      // Fallback to regular retrieval if reranking fails
      const fallbackResults = await this.getRelevantMemories(
        agentId,
        scope,
        query,
        {
          limit: finalLimit,
          tags: options.types
        }
      );
      
      return {
        entries: fallbackResults,
        hasConfidence: false
      };
    }
  }
  
  /**
   * Get all memory scopes an agent has access to
   */
  getAccessibleScopes(agentId: string): string[] {
    const agentScopes = this.agentMemoryMap.get(agentId);
    
    if (!agentScopes) {
      return this.options.enableSharedMemory ? [this.options.defaultNamespace || ''] : [];
    }
    
    return Array.from(agentScopes);
  }
  
  /**
   * Check if memory router is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Shutdown the memory router
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down MemoryRouter...');
    // Cleanup logic will be added here
  }
} 