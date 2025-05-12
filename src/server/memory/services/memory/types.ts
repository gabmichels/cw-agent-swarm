/**
 * Types for memory service
 */
import { MemoryFilter, MemoryType } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';

/**
 * Parameters for adding a memory
 */
export interface AddMemoryParams<T extends BaseMemorySchema> {
  // Memory type (message, thought, document, etc.)
  type: MemoryType;
  
  // Content to store
  content: string;
  
  // Optional payload data
  payload?: Omit<T, keyof BaseMemorySchema>;
  
  // Optional pre-computed embedding
  embedding?: number[];
  
  // Optional custom ID (generated if not provided)
  id?: string;
  
  // Optional metadata
  metadata?: Record<string, any>;
}

/**
 * Parameters for getting a memory
 */
export interface GetMemoryParams {
  // Memory type (message, thought, document, etc.)
  type: MemoryType;
  
  // Memory ID
  id: string;
  
  // Whether to include vector in response
  includeVector?: boolean;

  // Optional collection name
  collection?: string;
}

/**
 * Parameters for updating a memory
 */
export interface UpdateMemoryParams<T extends BaseMemorySchema> {
  // Memory type (message, thought, document, etc.)
  type: MemoryType;
  
  // Memory ID
  id: string;
  
  // Content updates (will regenerate embedding if provided)
  content?: string;
  
  // Payload updates (partial update)
  payload?: Partial<Omit<T, keyof BaseMemorySchema>>;
  
  // Metadata updates (partial update)
  metadata?: Record<string, any>;
  
  // Whether to preserve existing embedding
  preserveEmbedding?: boolean;

  // Optional collection name
  collection?: string;

  // Optional related memory IDs for cache invalidation
  relatedMemoryIds?: string[];
}

/**
 * Parameters for deleting a memory
 */
export interface DeleteMemoryParams {
  // Memory type (message, thought, document, etc.)
  type: MemoryType;
  
  // Memory ID
  id: string;
  
  // Whether to perform hard deletion
  hardDelete?: boolean;

  // Optional collection name
  collection?: string;

  // Optional related memory IDs for cache invalidation
  relatedMemoryIds?: string[];
}

/**
 * Parameters for searching memories
 */
export interface SearchMemoryParams {
  // Memory type (message, thought, document, etc.)
  type: MemoryType;
  
  // Search query text
  query?: string;
  
  // Pre-computed embedding vector
  vector?: number[];
  
  // Filter parameters
  filter?: MemoryFilter;
  
  // Maximum results to return
  limit?: number;
  
  // Offset for pagination
  offset?: number;
  
  // Minimum similarity score (0-1)
  minScore?: number;
  
  // Whether to include vectors in results
  includeVectors?: boolean;
}

/**
 * Memory operation result
 */
export interface MemoryResult {
  // Success status
  success: boolean;
  
  // Generated/provided ID
  id?: string;
  
  // Optional error information
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Memory search result with typed payload
 */
export interface MemorySearchResult<T extends BaseMemorySchema> {
  // Memory point
  point: MemoryPoint<T>;
  
  // Similarity score (0-1)
  score: number;
} 