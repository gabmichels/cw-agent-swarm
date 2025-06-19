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
}

/**
 * Enhanced memory service with dual-field support
 */
export class EnhancedMemoryService extends MemoryService {
  private embeddingClient: EmbeddingService;
  private memoryClient: IMemoryClient;
  private getTimestampFn: () => number;
  
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
   * Search with optimized field usage
   */
  async searchMemories<T extends BaseMemorySchema>(
    params: SearchMemoryParams
  ): Promise<EnhancedMemoryPoint<T>[]> {
    try {
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        throw new Error(`Invalid memory type: ${params.type}`);
      }
      
      // Create filter conditions using top-level fields when available
      const filterConditions = this.createOptimizedFilterConditions(params.filter || {});
      
      // If we have search text, get embedding
      let searchVector: number[] | undefined;
      if (params.query) {
        const embeddingResult = await this.embeddingClient.getEmbedding(params.query);
        searchVector = embeddingResult.embedding;
      }
      
      // Perform search using the memory client directly
      let results: EnhancedMemoryPoint<T>[] = [];
      
      if (searchVector) {
        // Vector search with filters
        const searchQuery: any = {
          vector: searchVector,
          limit: params.limit || 10,
          offset: params.offset || 0
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
          params.limit || 10,
          params.offset || 0
        );
        
        // Convert to enhanced memory points
        results = points.map(point => point as EnhancedMemoryPoint<T>);
      } else {
        // Get all points (limited)
        const points = await this.memoryClient.scrollPoints<T>(
          collectionConfig.name,
          undefined,
          params.limit || 10,
          params.offset || 0
        );
        
        results = points.map(point => point as EnhancedMemoryPoint<T>);
      }
      
      return results;
    } catch (error) {
      console.error('Error searching memories with optimization:', error);
      throw handleMemoryError(error, 'searchMemories');
    }
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
} 