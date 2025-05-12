/**
 * Memory service implementation
 */
import { v4 as uuidv4 } from 'uuid';
import { DEFAULTS, MemoryErrorCode, MemoryType } from '../../config';
import { COLLECTION_CONFIGS as COLLECTIONS, MEMORY_EDIT_COLLECTION } from '../../config/collections';
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { handleMemoryError, validateAddMemoryParams, validateGetMemoryParams, validateUpdateMemoryParams, validateDeleteMemoryParams } from '../../utils';
import { IMemoryClient, SearchQuery } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';
import { AddMemoryParams, DeleteMemoryParams, GetMemoryParams, MemoryResult, SearchMemoryParams, UpdateMemoryParams } from './types';
import { MemoryEditMetadata } from '../../../../types/metadata';

/**
 * Memory service options
 */
export interface MemoryServiceOptions {
  // Default timestamp function
  getTimestamp?: () => number;
}

/**
 * Core memory service for CRUD operations
 */
export class MemoryService {
  private client: IMemoryClient;
  private embeddingService: EmbeddingService;
  private getTimestamp: () => number;
  
  /**
   * Create a new memory service
   */
  constructor(client: IMemoryClient, embeddingService: EmbeddingService, options?: MemoryServiceOptions) {
    this.client = client;
    this.embeddingService = embeddingService;
    this.getTimestamp = options?.getTimestamp || (() => Date.now());
  }
  
  /**
   * Add a new memory
   */
  async addMemory<T extends BaseMemorySchema>(params: AddMemoryParams<T>): Promise<MemoryResult> {
    try {
      // Validate parameters
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
      
      // Generate ID if not provided
      const id = params.id || uuidv4();
      
      // Generate embedding if not provided
      const embedding = params.embedding || 
        (await this.embeddingService.getEmbedding(params.content)).embedding;
      
      // Create memory point
      const point: MemoryPoint<T> = {
        id,
        vector: embedding,
        payload: {
          text: params.content,
          type: params.type,
          timestamp: this.getTimestamp().toString(), // Convert to string
          ...(collectionConfig.defaults || {}),
          ...(params.payload || {}),
          metadata: {
            ...(collectionConfig.defaults?.metadata || {}),
            ...(params.metadata || {})
          }
        } as any
      };
      
      // Add to collection
      await this.client.addPoint(collectionConfig.name, point);
      
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
   * Get a memory by ID
   */
  async getMemory<T extends BaseMemorySchema>(params: GetMemoryParams): Promise<MemoryPoint<T> | null> {
    try {
      // Validate parameters
      const validation = validateGetMemoryParams(params);
      if (!validation.valid) {
        throw handleMemoryError(
          new Error(validation.errors?.[0]?.message || 'Invalid parameters'),
          'getMemory'
        );
      }
      
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        throw new Error(`Invalid memory type: ${params.type}`);
      }
      
      // Get from collection
      const points = await this.client.getPoints<T>(collectionConfig.name, [params.id]);
      
      // Return first point or null
      return points.length > 0 ? points[0] : null;
    } catch (error) {
      console.error('Error getting memory:', error);
      throw handleMemoryError(error, 'getMemory');
    }
  }
  
  /**
   * Update a memory by ID
   */
  async updateMemory<T extends BaseMemorySchema>(params: UpdateMemoryParams<T>): Promise<boolean> {
    try {
      // Validate parameters
      const validation = validateUpdateMemoryParams(params);
      if (!validation.valid) {
        throw handleMemoryError(
          new Error(validation.errors?.[0]?.message || 'Invalid parameters'),
          'updateMemory'
        );
      }
      
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        throw new Error(`Invalid memory type: ${params.type}`);
      }
      
      // Create update object
      const updates: Partial<MemoryPoint<T>> = {
        payload: {} as any
      };
      
      // Generate new embedding if content is changed and not preserving existing
      if (params.content && !params.preserveEmbedding) {
        updates.vector = (await this.embeddingService.getEmbedding(params.content)).embedding;
        (updates.payload as any).text = params.content;
      } else if (params.content) {
        (updates.payload as any).text = params.content;
      }
      
      // Add payload updates
      if (params.payload) {
        updates.payload = {
          ...updates.payload,
          ...(params.payload as any)
        };
      }
      
      // Add metadata updates
      if (params.metadata) {
        (updates.payload as any).metadata = {
          ...(updates.payload as any)?.metadata || {},
          ...params.metadata
        };
      }
      
      // Update point
      return await this.client.updatePoint(
        collectionConfig.name,
        params.id,
        updates
      );
    } catch (error) {
      console.error('Error updating memory:', error);
      throw handleMemoryError(error, 'updateMemory');
    }
  }
  
  /**
   * Delete a memory by ID
   */
  async deleteMemory(params: DeleteMemoryParams): Promise<boolean> {
    try {
      // Validate parameters
      const validation = validateDeleteMemoryParams(params);
      if (!validation.valid) {
        throw handleMemoryError(
          new Error(validation.errors?.[0]?.message || 'Invalid parameters'),
          'deleteMemory'
        );
      }
      
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        throw new Error(`Invalid memory type: ${params.type}`);
      }
      
      // Delete from collection
      return await this.client.deletePoint(
        collectionConfig.name,
        params.id,
        { hardDelete: params.hardDelete }
      );
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw handleMemoryError(error, 'deleteMemory');
    }
  }
  
  /**
   * Search for memories
   */
  async searchMemories<T extends BaseMemorySchema>(params: SearchMemoryParams): Promise<MemoryPoint<T>[]> {
    try {
      // Get collection configuration
      const collectionConfig = COLLECTIONS[params.type];
      if (!collectionConfig) {
        throw new Error(`Invalid memory type: ${params.type}`);
      }
      
      // Generate embedding from query if not provided
      let searchVector = params.vector;
      if (!searchVector && params.query) {
        searchVector = (await this.embeddingService.getEmbedding(params.query)).embedding;
      }
      
      // Search collection
      const results = await this.client.searchPoints<T>(collectionConfig.name, {
        vector: searchVector,
        filter: params.filter,
        limit: params.limit || DEFAULTS.DEFAULT_LIMIT,
        offset: params.offset,
        includeVectors: params.includeVectors,
        scoreThreshold: params.minScore
      });
      
      // Return memory points - properly handle MemorySearchResult structure
      return results.map(result => ({
        id: result.id,
        vector: [],  // Default empty vector if not included
        payload: result.payload
      }));
    } catch (error) {
      console.error('Error searching memories:', error);
      throw handleMemoryError(error, 'searchMemories');
    }
  }
  
  /**
   * Get version history for a memory
   */
  async getMemoryHistory<T extends BaseMemorySchema>(params: {
    id: string;
    type?: MemoryType;
    limit?: number;
  }): Promise<MemoryPoint<T>[]> {
    try {
      // If type is not specified, try to determine it from an existing memory
      let memoryType = params.type;
      
      if (!memoryType) {
        // Try each collection type until we find the memory
        for (const type of Object.values(MemoryType)) {
          const memory = await this.getMemory({
            id: params.id,
            type
          });
          
          if (memory) {
            memoryType = type;
            break;
          }
        }
        
        // If still not found, use default type
        if (!memoryType) {
          memoryType = MemoryType.MESSAGE;
        }
      }
      
      // Get the current memory
      const currentMemory = await this.getMemory<T>({
        id: params.id,
        type: memoryType
      });
      
      if (!currentMemory) {
        return [];
      }

      // Get all memory edits for this memory
      const searchQuery: SearchQuery = {
        filter: {
          'metadata.original_memory_id': params.id
        },
        limit: params.limit || 10,
        sort: {
          field: 'payload.timestamp',
          direction: 'desc'
        }
      };

      const editRecords = await this.client.searchPoints(
        MEMORY_EDIT_COLLECTION.name,
        searchQuery
      );

      // Convert edit records to memory points
      const history: MemoryPoint<T>[] = editRecords.map(edit => {
        const metadata = edit.payload.metadata as MemoryEditMetadata;
        return {
          id: edit.id,
          vector: (edit as any).vector || [],
          payload: {
            ...edit.payload,
            type: metadata.original_type as MemoryType || memoryType,
            timestamp: edit.payload.timestamp,
            metadata: {
              ...metadata,
              isMemoryEdit: true,
              edit_type: metadata.edit_type || 'update',
              editor_type: metadata.editor_type || 'system',
              editor_id: metadata.editor_id,
              diff_summary: metadata.diff_summary,
              current: metadata.current || false,
              previous_version_id: metadata.previous_version_id
            }
          } as any
        };
      });

      // Add current memory as the latest version if it exists
      if (currentMemory) {
        history.unshift({
          ...currentMemory,
          payload: {
            ...currentMemory.payload,
            metadata: {
              ...currentMemory.payload.metadata,
              isMemoryEdit: false,
              current: true
            }
          } as any
        });
      }

      return history;
    } catch (error) {
      console.error('Error getting memory history:', error);
      throw handleMemoryError(error, 'getMemoryHistory');
    }
  }
} 