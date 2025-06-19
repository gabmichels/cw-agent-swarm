/**
 * Enhanced Memory Service
 * 
 * This service extends the base memory service with dual-field support
 * for improved query performance in multi-agent systems.
 */

import { ulid } from 'ulid';
import { MemoryService } from '../memory/memory-service';
import { DEFAULTS, MemoryErrorCode, MemoryType } from '../../config';
import { COLLECTION_CONFIGS as COLLECTIONS } from '../../config/collections';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { handleMemoryError, validateAddMemoryParams } from '../../utils';
import { AddMemoryParams, MemoryResult, SearchMemoryParams } from '../memory/types';
import { StructuredId } from '../../../../utils/ulid';
import { structuredIdToString } from '../../../../types/entity-identifier';
import { EmbeddingService } from '../client/embedding-service';
import { IMemoryClient } from '../client/types';
import { PerformanceOptimizer, PerformanceOptimizerConfig, VectorSearchOptimization } from './performance-optimizer';
import { CacheManager } from '../cache/types';

/**
 * Agent communication types following IMPLEMENTATION_GUIDELINES.md
 */
export enum AgentCommunicationType {
  DIRECT_MESSAGE = 'direct_message',
  BROADCAST = 'broadcast',
  TASK_DELEGATION = 'task_delegation',
  COLLABORATION_REQUEST = 'collaboration_request',
  STATUS_UPDATE = 'status_update',
  KNOWLEDGE_SHARING = 'knowledge_sharing'
}

export enum AgentMemoryAccessLevel {
  PRIVATE = 'private',           // Only the agent itself
  TEAM = 'team',                // Agents in the same team
  PROJECT = 'project',          // Agents working on the same project
  PUBLIC = 'public',            // All agents
  RESTRICTED = 'restricted'     // Specific agents only
}

/**
 * Agent memory permission interface
 */
export interface AgentMemoryPermission {
  readonly agentId: string;
  readonly accessLevel: AgentMemoryAccessLevel;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canShare: boolean;
  readonly expiresAt?: Date;
}

/**
 * Agent-to-agent communication parameters
 */
export interface AgentCommunicationParams<T extends BaseMemorySchema> extends AddMemoryParams<T> {
  readonly senderAgentId: string;
  readonly receiverAgentId?: string;  // Optional for broadcasts
  readonly communicationType: AgentCommunicationType;
  readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
  readonly accessLevel?: AgentMemoryAccessLevel;
  readonly permissions?: readonly AgentMemoryPermission[];
  readonly teamId?: string;
  readonly projectId?: string;
}

/**
 * Agent memory search parameters
 */
export interface AgentMemorySearchParams extends SearchMemoryParams {
  readonly requestingAgentId: string;
  readonly senderAgentId?: string;
  readonly receiverAgentId?: string;
  readonly communicationType?: AgentCommunicationType;
  readonly accessLevel?: AgentMemoryAccessLevel;
  readonly teamId?: string;
  readonly projectId?: string;
}

/**
 * Enhanced memory point with top-level indexable fields
 * This implements the dual-field approach for improved query performance
 */
export interface EnhancedMemoryPoint<T extends BaseMemorySchema> extends MemoryPoint<T> {
  // Indexable fields for common queries - duplicated from metadata for performance
  userId?: string;       // From payload.metadata.userId
  agentId?: string;      // From payload.metadata.agentId
  chatId?: string;       // From payload.metadata.chatId
  threadId?: string;     // From payload.metadata.thread?.id
  messageType?: string;  // From payload.metadata.messageType
  timestamp?: number;    // From payload.timestamp (as number)
  importance?: string;   // From payload.metadata.importance
  
  // Agent-to-agent communication fields
  senderAgentId?: string;    // From payload.metadata.senderAgentId
  receiverAgentId?: string;  // From payload.metadata.receiverAgentId
  communicationType?: string; // From payload.metadata.communicationType
  priority?: string;         // From payload.metadata.priority
}

/**
 * Field mapping for metadata to top-level fields
 */
const FIELD_MAPPING: Record<string, string> = {
  'metadata.userId.id': 'userId',
  'metadata.agentId.id': 'agentId',
  'metadata.chatId.id': 'chatId',
  'metadata.thread.id': 'threadId',
  'metadata.messageType': 'messageType',
  'metadata.importance': 'importance',
  'metadata.senderAgentId.id': 'senderAgentId',
  'metadata.receiverAgentId.id': 'receiverAgentId',
  'metadata.communicationType': 'communicationType',
  'metadata.priority': 'priority'
};

/**
 * Enhanced memory service options
 */
export interface EnhancedMemoryServiceOptions {
  // Default timestamp function
  getTimestamp?: () => number;
  // Performance optimization configuration
  performanceConfig?: Partial<PerformanceOptimizerConfig>;
  // Cache manager for performance optimization
  cacheManager?: CacheManager;
  // Enable performance optimization
  enablePerformanceOptimization?: boolean;
}

/**
 * Enhanced memory service with dual-field support and performance optimization
 */
export class EnhancedMemoryService extends MemoryService {
  private embeddingClient: EmbeddingService;
  private memoryClient: IMemoryClient;
  private getTimestampFn: () => number;
  private performanceOptimizer?: PerformanceOptimizer;
  
  /**
   * Create a new enhanced memory service
   */
  constructor(
    memoryClient: IMemoryClient, 
    embeddingClient: EmbeddingService, 
    options?: EnhancedMemoryServiceOptions
  ) {
    super(memoryClient, embeddingClient, options);
    this.memoryClient = memoryClient;
    this.embeddingClient = embeddingClient;
    this.getTimestampFn = options?.getTimestamp || (() => Date.now());
    
    // Initialize performance optimizer if enabled and cache manager provided
    if (options?.enablePerformanceOptimization !== false && options?.cacheManager) {
      this.performanceOptimizer = new PerformanceOptimizer(
        options.cacheManager,
        options.performanceConfig
      );
    }
  }
  
  /**
   * Add a memory with top-level indexable fields
   */
  async addMemory<T extends BaseMemorySchema>(params: AddMemoryParams<T>): Promise<MemoryResult> {
    try {
      // Validate parameters (use existing validation)
      const validation = validateAddMemoryParams(params);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MemoryErrorCode.VALIDATION_ERROR,
            message: validation.errors?.[0]?.message || 'Invalid parameters'
          }
        };
      }
      
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        return {
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: `Invalid memory type: ${params.type}`
          }
        };
      }
      
      // Generate ID if not provided (use ULID for better performance and sorting)
      const id = params.id || ulid();
      
      // Generate embedding if not provided
      const embedding = params.embedding || 
        (await this.embeddingClient.getEmbedding(params.content)).embedding;
      
      // Create memory point
      const point: MemoryPoint<T> = {
        id,
        vector: embedding,
        payload: {
          id,
          text: params.content,
          type: params.type,
          timestamp: this.getTimestampFn().toString(), // Convert to string
          ...(collectionConfig.defaults || {}),
          ...(params.payload || {}),
          metadata: {
            ...(collectionConfig.defaults?.metadata || {}),
            ...(params.metadata || {})
          }
        } as unknown as T
      };
      
      // Extract indexable fields from metadata
      const indexableFields = this.extractIndexableFields((params.metadata || {}));
      
      // Create enhanced memory point with both in-metadata and top-level fields
      const enhancedPoint: EnhancedMemoryPoint<T> = {
        ...point,
        ...indexableFields,
        // Add timestamp as number for better filtering
        timestamp: this.getTimestampFn()
      };
      
      // Add to collection
      await this.memoryClient.addPoint(collectionConfig.name, enhancedPoint);
      
      return {
        success: true,
        id
      };
    } catch (error) {
      console.error('Error adding memory:', error);
      
      const memoryError = handleMemoryError(error, 'addMemory');
      return {
        success: false,
        error: {
          code: memoryError.code,
          message: memoryError.message
        }
      };
    }
  }
  
  /**
   * Extract indexable fields from metadata
   */
  private extractIndexableFields(metadata: Record<string, any>): Record<string, string> {
    if (!metadata) return {};
    
    const fields: Record<string, string> = {};
    
    // User and conversation context
    if (metadata.userId && typeof metadata.userId === 'object') {
      fields.userId = this.getIdString(metadata.userId);
    }
    
    if (metadata.agentId && typeof metadata.agentId === 'object') {
      fields.agentId = this.getIdString(metadata.agentId);
    }
    
    if (metadata.chatId && typeof metadata.chatId === 'object') {
      fields.chatId = this.getIdString(metadata.chatId);
    }
    
    // Thread and message info
    if (metadata.thread?.id) {
      fields.threadId = this.getIdString(metadata.thread.id);
    }
    
    if (metadata.messageType) {
      fields.messageType = String(metadata.messageType);
    }
    
    // Classification and importance
    if (metadata.importance) {
      fields.importance = String(metadata.importance);
    }
    
    // Agent-to-agent communication fields
    if (metadata.senderAgentId && typeof metadata.senderAgentId === 'object') {
      fields.senderAgentId = this.getIdString(metadata.senderAgentId);
    }
    
    if (metadata.receiverAgentId && typeof metadata.receiverAgentId === 'object') {
      fields.receiverAgentId = this.getIdString(metadata.receiverAgentId);
    }
    
    if (metadata.communicationType) {
      fields.communicationType = String(metadata.communicationType);
    }
    
    if (metadata.priority) {
      fields.priority = String(metadata.priority);
    }
    
    return fields;
  }
  
  /**
   * Convert a StructuredId to a string
   */
  private getIdString(id: StructuredId | string): string {
    if (typeof id === 'string') {
      return id;
    }
    
    // Handle StructuredId objects using the existing utility function
    if (typeof id === 'object' && id !== null) {
      if ('toString' in id && typeof id.toString === 'function') {
        return id.toString();
      }
      
      if ('id' in id && typeof id.id === 'string') {
        return id.id;
      }
      
      if ('namespace' in id && 'type' in id && 'id' in id) {
        return structuredIdToString(id as any);
      }
    }
    
    return String(id);
  }
  
  /**
   * Search with optimized field usage and performance optimization
   */
  async searchMemories<T extends BaseMemorySchema>(
    params: SearchMemoryParams
  ): Promise<EnhancedMemoryPoint<T>[]> {
    try {
      // Use performance optimizer if available
      if (this.performanceOptimizer) {
        return await this.performanceOptimizer.executeOptimizedSearch<T>(
          params,
          async (optimizedParams, optimization) => {
            return await this.executeSearchWithOptimization<T>(optimizedParams as SearchMemoryParams, optimization);
          }
        );
      }
      
      // Fallback to standard search
      return await this.executeSearchWithOptimization<T>(params);
    } catch (error) {
      console.error('Error searching memories with optimization:', error);
      throw handleMemoryError(error, 'searchMemories');
    }
  }
  
  /**
   * Execute search with optional optimization parameters
   */
  private async executeSearchWithOptimization<T extends BaseMemorySchema>(
    params: SearchMemoryParams,
    optimization?: VectorSearchOptimization
  ): Promise<EnhancedMemoryPoint<T>[]> {
    // Get collection configuration
    const collectionConfig = COLLECTIONS[params.type];
    if (!collectionConfig) {
      throw new Error(`Invalid memory type: ${params.type}`);
    }
    
    // Apply optimization parameters if provided
    const effectiveParams = optimization ? {
      ...params,
      limit: optimization.limit,
      minScore: optimization.scoreThreshold
    } : params;
    
    // Create filter conditions using top-level fields when available
    const filterConditions = this.createOptimizedFilterConditions(effectiveParams.filter || {});
    
    // If we have search text, get embedding
    let searchVector: number[] | undefined;
    if (effectiveParams.query) {
      const embeddingResult = await this.embeddingClient.getEmbedding(effectiveParams.query);
      searchVector = embeddingResult.embedding;
    }
    
    // Perform search using the memory client directly
    let results: EnhancedMemoryPoint<T>[] = [];
    
    if (searchVector) {
      // Vector search with filters
      const searchQuery: any = {
        vector: searchVector,
        limit: effectiveParams.limit || 10,
        offset: effectiveParams.offset || 0,
        scoreThreshold: effectiveParams.minScore
      };
      
      // Add filter conditions if available
      if (filterConditions && filterConditions.length > 0) {
        searchQuery.filter = { must: filterConditions };
      }
      
      const searchResults = await this.memoryClient.searchPoints<T>(
        collectionConfig.name,
        searchQuery
      );
      
      // Extract points from search results - convert MemorySearchResult to MemoryPoint format
      results = searchResults.map(result => ({
        id: result.id,
        vector: [], // Vector not needed for return
        payload: result.payload,
        // Add enhanced fields if they exist in payload metadata
        ...this.extractIndexableFields(result.payload.metadata || {})
      } as EnhancedMemoryPoint<T>));
    } else if (filterConditions && filterConditions.length > 0) {
      // Filter-only search (scroll with filters)
      const scrollFilter = { must: filterConditions };
      
      const points = await this.memoryClient.scrollPoints<T>(
        collectionConfig.name,
        scrollFilter,
        effectiveParams.limit || 10,
        effectiveParams.offset || 0
      );
      
      // Convert to enhanced memory points
      results = points.map(point => point as EnhancedMemoryPoint<T>);
    } else {
      // Get all points (limited)
      const points = await this.memoryClient.scrollPoints<T>(
        collectionConfig.name,
        undefined,
        effectiveParams.limit || 10,
        effectiveParams.offset || 0
      );
      
      results = points.map(point => point as EnhancedMemoryPoint<T>);
    }
    
    return results;
  }
  
  /**
   * Create optimized filter conditions using top-level fields when possible
   */
  private createOptimizedFilterConditions(
    filters: Record<string, any>
  ): any[] {
    const conditions: any[] = [];
    
    // Process each filter
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      
      // Skip special keys like $conditions
      if (key.startsWith('$')) return;
      
      // Check if there's a top-level field for this metadata path
      const metadataPath = `metadata.${key}`;
      const topLevelField = FIELD_MAPPING[metadataPath];
      
      // Handle structured IDs in filters
      const stringValue = this.getFilterValueAsString(value);
      
      if (topLevelField) {
        // Use top-level field for better performance
        conditions.push({ 
          key: topLevelField, 
          match: { value: stringValue } 
        });
      } else {
        // Fall back to metadata field
        conditions.push({ 
          key: metadataPath, 
          match: { value: stringValue } 
        });
      }
    });
    
    return conditions;
  }
  
  /**
   * Convert filter value to string, handling structured IDs
   */
  private getFilterValueAsString(value: any): string {
    // Handle structured IDs in filters
    if (typeof value === 'object' && value !== null) {
      return this.getIdString(value);
    }
    
    return String(value);
  }

  // ============================================================================
  // AGENT-TO-AGENT COMMUNICATION METHODS
  // Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions
  // ============================================================================

  /**
   * Send a message from one agent to another
   * Pure function with immutable parameters and strict typing
   */
  async sendAgentMessage<T extends BaseMemorySchema>(
    params: AgentCommunicationParams<T>
  ): Promise<MemoryResult> {
    try {
      // Validate agent communication parameters
      const validation = this.validateAgentCommunicationParams(params);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MemoryErrorCode.VALIDATION_ERROR,
            message: validation.errors?.[0]?.message || 'Invalid agent communication parameters'
          }
        };
      }

      // Generate ULID for better performance and sorting
      const messageId = ulid();
      
      // Create enhanced metadata with agent communication fields
      const enhancedMetadata = {
        ...params.metadata,
        senderAgentId: { id: params.senderAgentId, type: 'agent' },
        receiverAgentId: params.receiverAgentId ? { id: params.receiverAgentId, type: 'agent' } : undefined,
        communicationType: params.communicationType,
        priority: params.priority || 'medium',
        accessLevel: params.accessLevel || AgentMemoryAccessLevel.PRIVATE,
        teamId: params.teamId ? { id: params.teamId, type: 'team' } : undefined,
        projectId: params.projectId ? { id: params.projectId, type: 'project' } : undefined,
        messageId,
        timestamp: this.getTimestampFn()
      };

      // Add memory using enhanced parameters
      const addParams: AddMemoryParams<T> = {
        ...params,
        id: messageId,
        metadata: enhancedMetadata
      };

      return await this.addMemory(addParams);
    } catch (error) {
      console.error('Error sending agent message:', error);
      const memoryError = handleMemoryError(error, 'sendAgentMessage');
      return {
        success: false,
        error: {
          code: memoryError.code,
          message: memoryError.message
        }
      };
    }
  }

  /**
   * Search agent memories with access control and performance optimization
   */
  async searchAgentMemories<T extends BaseMemorySchema>(
    params: AgentMemorySearchParams
  ): Promise<EnhancedMemoryPoint<T>[]> {
    try {
      // Validate agent access
      const accessValidation = this.validateAgentAccess(params);
      if (!accessValidation.valid) {
        throw new Error(accessValidation.error || 'Access denied');
      }

      // Build agent-specific filters
      const agentFilters = this.buildAgentAccessFilter(params);
      
      // Combine with existing filters
      const combinedFilters = {
        ...params.filter,
        ...agentFilters
      };

      // Create search parameters with agent filters
      const searchParams: SearchMemoryParams = {
        ...params,
        filter: combinedFilters
      };

      // Use performance optimizer if available
      if (this.performanceOptimizer) {
        return await this.performanceOptimizer.executeOptimizedSearch<T>(
          searchParams,
          async (optimizedParams, optimization) => {
            return await this.executeSearchWithOptimization<T>(optimizedParams as SearchMemoryParams, optimization);
          }
        );
      }
      
      // Fallback to standard search
      return await this.executeSearchWithOptimization<T>(searchParams);
    } catch (error) {
      console.error('Error searching agent memories:', error);
      throw handleMemoryError(error, 'searchAgentMemories');
    }
  }

  /**
   * Get agent conversation history
   * Pure function with immutable parameters
   */
  async getAgentConversationHistory<T extends BaseMemorySchema>(
    agentId: string,
    otherAgentId?: string,
    options: {
      readonly limit?: number;
      readonly offset?: number;
      readonly communicationType?: AgentCommunicationType;
      readonly since?: Date;
    } = {}
  ): Promise<EnhancedMemoryPoint<T>[]> {
    try {
      // Build conversation filter
      const conversationFilter: Record<string, any> = {};
      
      if (otherAgentId) {
        // Conversation between two specific agents
        conversationFilter.$or = [
          { 
            senderAgentId: agentId,
            receiverAgentId: otherAgentId
          },
          {
            senderAgentId: otherAgentId,
            receiverAgentId: agentId
          }
        ];
      } else {
        // All conversations involving this agent
        conversationFilter.$or = [
          { senderAgentId: agentId },
          { receiverAgentId: agentId }
        ];
      }

      if (options.communicationType) {
        conversationFilter.communicationType = options.communicationType;
      }

      if (options.since) {
        conversationFilter.timestamp = { $gte: options.since.getTime() };
      }

      // Search with conversation filter
      const searchParams: AgentMemorySearchParams = {
        type: MemoryType.MESSAGE,
        requestingAgentId: agentId,
        filter: conversationFilter,
        limit: options.limit || 50,
        offset: options.offset || 0
      };

      return await this.searchAgentMemories<T>(searchParams);
    } catch (error) {
      console.error('Error getting agent conversation history:', error);
      throw handleMemoryError(error, 'getAgentConversationHistory');
    }
  }

  /**
   * Broadcast message to multiple agents
   * Pure function with immutable parameters
   */
  async broadcastAgentMessage<T extends BaseMemorySchema>(
    params: Omit<AgentCommunicationParams<T>, 'receiverAgentId'> & {
      readonly receiverAgentIds?: readonly string[];
      readonly teamId?: string;
      readonly accessLevel: AgentMemoryAccessLevel;
    }
  ): Promise<MemoryResult[]> {
    try {
      const results: MemoryResult[] = [];
      
      if (params.receiverAgentIds && params.receiverAgentIds.length > 0) {
        // Send to specific agents
        for (const receiverAgentId of params.receiverAgentIds) {
          const messageParams: AgentCommunicationParams<T> = {
            ...params,
            receiverAgentId,
            communicationType: AgentCommunicationType.BROADCAST
          };
          
          const result = await this.sendAgentMessage(messageParams);
          results.push(result);
        }
      } else {
        // Team or public broadcast
        const broadcastParams: AgentCommunicationParams<T> = {
          ...params,
          communicationType: AgentCommunicationType.BROADCAST
        };
        
        const result = await this.sendAgentMessage(broadcastParams);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Error broadcasting agent message:', error);
      throw handleMemoryError(error, 'broadcastAgentMessage');
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // Pure functions following IMPLEMENTATION_GUIDELINES.md principles
  // ============================================================================

  /**
   * Validate agent communication parameters
   * Pure function with immutable input
   */
  private validateAgentCommunicationParams<T extends BaseMemorySchema>(
    params: AgentCommunicationParams<T>
  ): { valid: boolean; errors?: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate required fields
    if (!params.senderAgentId || params.senderAgentId.trim() === '') {
      errors.push({ field: 'senderAgentId', message: 'Sender agent ID is required' });
    }

    if (!params.communicationType) {
      errors.push({ field: 'communicationType', message: 'Communication type is required' });
    }

    if (!Object.values(AgentCommunicationType).includes(params.communicationType)) {
      errors.push({ field: 'communicationType', message: 'Invalid communication type' });
    }

    // Validate access level if provided
    if (params.accessLevel && !Object.values(AgentMemoryAccessLevel).includes(params.accessLevel)) {
      errors.push({ field: 'accessLevel', message: 'Invalid access level' });
    }

    // Validate receiver for non-broadcast messages
    if (params.communicationType !== AgentCommunicationType.BROADCAST && !params.receiverAgentId) {
      errors.push({ field: 'receiverAgentId', message: 'Receiver agent ID is required for non-broadcast messages' });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate agent access permissions
   * Pure function with immutable input
   */
  private validateAgentAccess(
    params: AgentMemorySearchParams
  ): { valid: boolean; error?: string } {
    // Basic validation - can be extended with more sophisticated access control
    if (!params.requestingAgentId || params.requestingAgentId.trim() === '') {
      return { valid: false, error: 'Requesting agent ID is required' };
    }

    // For now, allow all authenticated agents - can be enhanced with role-based access
    return { valid: true };
  }

  /**
   * Build agent access filter
   * Pure function that returns immutable filter object
   */
  private buildAgentAccessFilter(
    params: AgentMemorySearchParams
  ): Record<string, any> {
    const filter: Record<string, any> = {};
    
    // Add agent-specific filters
    if (params.senderAgentId) {
      filter.senderAgentId = params.senderAgentId;
    }
    
    if (params.receiverAgentId) {
      filter.receiverAgentId = params.receiverAgentId;
    }
    
    if (params.communicationType) {
      filter.communicationType = params.communicationType;
    }
    
    if (params.teamId) {
      filter.teamId = params.teamId;
    }
    
    if (params.projectId) {
      filter.projectId = params.projectId;
    }

    // Access level filtering
    if (params.accessLevel) {
      filter.accessLevel = params.accessLevel;
    } else {
      // Default: only show memories the agent has access to
      filter.$or = [
        { senderAgentId: params.requestingAgentId },
        { receiverAgentId: params.requestingAgentId },
        { accessLevel: AgentMemoryAccessLevel.PUBLIC },
        { teamId: params.teamId },
        { projectId: params.projectId }
      ];
    }

    return filter;
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Get performance statistics from the optimizer
   */
  getPerformanceStats(): any {
    if (!this.performanceOptimizer) {
      return {
        cache: { hitRate: 0, totalQueries: 0, avgResponseTime: 0 },
        queries: { avgExecutionTime: 0, slowQueries: 0, totalQueries: 0 },
        optimization: { strategiesUsed: {}, avgScoreThreshold: 0, avgLimit: 0 }
      };
    }
    
    return this.performanceOptimizer.getPerformanceStats();
  }

  /**
   * Clear performance cache
   */
  async clearPerformanceCache(pattern?: {
    collection?: string;
    agentId?: string;
    type?: string;
  }): Promise<void> {
    if (this.performanceOptimizer) {
      await this.performanceOptimizer.clearCache(pattern);
    }
  }

  /**
   * Get optimization recommendations for a query
   */
  getOptimizationRecommendations(params: SearchMemoryParams | AgentMemorySearchParams): string[] {
    if (!this.performanceOptimizer) {
      return ['Performance optimization not enabled'];
    }
    
    return this.performanceOptimizer.getOptimizationRecommendations(params);
  }

  /**
   * Check if performance optimization is enabled
   */
  isPerformanceOptimizationEnabled(): boolean {
    return !!this.performanceOptimizer;
  }
} 