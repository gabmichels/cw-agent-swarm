/**
 * Memory Service Base Class Types
 * 
 * This module defines the interfaces and types for the memory service base classes.
 * These interfaces provide a standardized way to interact with different memory collections
 * while enforcing type safety, validation, and proper error handling.
 */

import { JSONSchema7 } from 'json-schema';
import { Result } from '../../../../lib/errors/base';
import { FilterOperator } from '../filters/types';
import { BaseMemoryEntity, Schema } from '../../schema/types';
import { StructuredId } from '../../../../utils/ulid';
import { SearchResults } from '../query/types';

/**
 * Filter condition for a field
 */
export interface FilterCondition<T> {
  /**
   * The filter operation to apply
   */
  operator: FilterOperator;
  
  /**
   * The value to filter on
   */
  value: T | T[] | null;
}

/**
 * Type-safe filter conditions for entity fields
 */
export type FilterConditions<T> = {
  [K in keyof T]?: FilterCondition<T[K]>;
};

/**
 * Options for filter operations
 */
export interface FilterOptions {
  /**
   * Whether to include deleted items
   * @default false
   */
  includeDeleted?: boolean;
  
  /**
   * Max number of results to return
   * @default 100
   */
  limit?: number;
  
  /**
   * Number of results to skip
   * @default 0
   */
  offset?: number;
  
  /**
   * Score threshold for similarity searches
   * @default 0.0
   */
  scoreThreshold?: number;
}

/**
 * Options for creating a memory entity
 */
export interface CreateOptions {
  /**
   * Whether to apply default values
   * @default true
   */
  applyDefaults?: boolean;
  
  /**
   * Custom creation timestamp
   * @default current time
   */
  createdAt?: Date;
  
  /**
   * Validation options
   */
  validation?: {
    /**
     * Whether to validate against schema
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Whether to throw on validation error
     * @default true
     */
    throwOnError?: boolean;
  }
}

/**
 * Options for updating a memory entity
 */
export interface UpdateOptions {
  /**
   * Custom update timestamp
   * @default current time
   */
  updatedAt?: Date;
  
  /**
   * Whether to validate updates against schema
   * @default true
   */
  validate?: boolean;
  
  /**
   * Whether to merge metadata or replace it
   * @default true - merge
   */
  mergeMetadata?: boolean;
}

/**
 * Options for deleting a memory entity
 */
export interface DeleteOptions {
  /**
   * Whether to hard delete (true) or soft delete (false)
   * @default false - soft delete
   */
  hardDelete?: boolean;
  
  /**
   * Additional metadata to record with deletion
   */
  metadata?: Record<string, unknown>;
}

/**
 * Search parameters for memory entities
 */
export interface SearchParams<T extends BaseMemoryEntity> {
  /**
   * Text query to search for
   */
  query?: string;
  
  /**
   * Pre-computed vector for similarity search
   */
  vector?: number[];
  
  /**
   * Filter conditions to apply to search
   */
  filter?: FilterConditions<T>;
  
  /**
   * Maximum number of results to return
   * @default 10
   */
  limit?: number;
  
  /**
   * Offset for pagination
   * @default 0
   */
  offset?: number;
  
  /**
   * Minimum similarity score (0-1)
   * @default 0.0
   */
  scoreThreshold?: number;
  
  /**
   * Whether to include deleted items
   * @default false
   */
  includeDeleted?: boolean;
}

/**
 * Generic repository interface for memory entities
 */
export interface IMemoryRepository<T extends BaseMemoryEntity> {
  /**
   * Collection name
   */
  readonly collectionName: string;
  
  /**
   * Schema for this repository
   */
  readonly schema: Schema<T>;
  
  /**
   * Create a new memory entity
   * @param entity Entity data
   * @param options Creation options
   * @returns The created entity with ID and timestamps
   */
  create(
    entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>,
    options?: CreateOptions
  ): Promise<T>;
  
  /**
   * Get entity by ID
   * @param id Entity ID
   * @returns Entity or null if not found
   */
  getById(id: StructuredId | string): Promise<T | null>;
  
  /**
   * Update entity by ID
   * @param id Entity ID
   * @param updates Partial entity updates
   * @param options Update options
   * @returns Updated entity or null if not found
   */
  update(
    id: StructuredId | string,
    updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>>,
    options?: UpdateOptions
  ): Promise<T | null>;
  
  /**
   * Delete entity by ID
   * @param id Entity ID
   * @param options Delete options
   * @returns Whether deletion was successful
   */
  delete(
    id: StructuredId | string, 
    options?: DeleteOptions
  ): Promise<boolean>;
  
  /**
   * Search for entities by text query
   * @param query Text query
   * @param options Search options
   * @returns Matching entities
   */
  search(
    query: string,
    options?: FilterOptions
  ): Promise<T[]>;
  
  /**
   * Search by vector directly
   * @param vector Embedding vector
   * @param options Search options
   * @returns Matching entities
   */
  searchByVector(
    vector: number[],
    options?: FilterOptions
  ): Promise<T[]>;
  
  /**
   * Filter entities by conditions
   * @param conditions Filter conditions
   * @param options Filter options
   * @returns Matching entities
   */
  filter(
    conditions: FilterConditions<T>,
    options?: FilterOptions
  ): Promise<T[]>;
  
  /**
   * Get all entities (with optional pagination)
   * @param options Pagination options
   * @returns All entities
   */
  getAll(options?: FilterOptions): Promise<T[]>;
  
  /**
   * Count entities matching conditions
   * @param conditions Filter conditions
   * @returns Count of matching entities
   */
  count(conditions?: FilterConditions<T>): Promise<number>;
  
  /**
   * Check if entity exists
   * @param id Entity ID
   * @returns Whether entity exists
   */
  exists(id: StructuredId | string): Promise<boolean>;
}

/**
 * Memory service interface for business logic
 */
export interface IMemoryService<T extends BaseMemoryEntity> {
  /**
   * The repository this service uses
   */
  readonly repository: IMemoryRepository<T>;
  
  /**
   * Create a new memory entity
   * @param params Entity data
   * @param options Creation options
   * @returns Result with created entity or error
   */
  create(
    params: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>,
    options?: CreateOptions
  ): Promise<Result<T>>;
  
  /**
   * Get entity by ID
   * @param id Entity ID
   * @returns Result with entity or error
   */
  getById(id: StructuredId | string): Promise<Result<T | null>>;
  
  /**
   * Update entity by ID
   * @param id Entity ID
   * @param updates Partial entity updates
   * @param options Update options
   * @returns Result with updated entity or error
   */
  update(
    id: StructuredId | string,
    updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>>,
    options?: UpdateOptions
  ): Promise<Result<T | null>>;
  
  /**
   * Delete entity by ID
   * @param id Entity ID
   * @param options Delete options
   * @returns Result with deletion success or error
   */
  delete(
    id: StructuredId | string,
    options?: DeleteOptions
  ): Promise<Result<boolean>>;
  
  /**
   * Search for entities
   * @param params Search parameters
   * @returns Result with matching entities or error
   */
  search(params: SearchParams<T>): Promise<Result<T[]>>;
  
  /**
   * Execute operation with transaction support
   * @param operation Function that performs the operation
   * @returns Result of the operation
   */
  withTransaction<R>(
    operation: (repo: IMemoryRepository<T>) => Promise<R>
  ): Promise<Result<R>>;
}

/**
 * Vector database record
 */
export interface DatabaseRecord {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * Database client interface
 */
export interface IVectorDatabaseClient {
  /**
   * Add point to collection
   */
  addPoint(
    collectionName: string, 
    point: DatabaseRecord
  ): Promise<string>;
  
  /**
   * Get points by IDs
   */
  getPoints(
    collectionName: string, 
    ids: string[]
  ): Promise<DatabaseRecord[]>;
  
  /**
   * Search points by vector similarity
   */
  search(
    collectionName: string,
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
    scoreThreshold?: number
  ): Promise<SearchResults>;
  
  /**
   * Search points by vector similarity (legacy method)
   */
  searchPoints(
    collectionName: string,
    vector: number[],
    options?: FilterOptions
  ): Promise<DatabaseRecord[]>;
  
  /**
   * Update point by ID
   */
  updatePoint(
    collectionName: string,
    id: string,
    updates: Partial<DatabaseRecord>
  ): Promise<boolean>;
  
  /**
   * Delete point by ID
   */
  deletePoint(
    collectionName: string,
    id: string,
    options?: DeleteOptions
  ): Promise<boolean>;
}

/**
 * Embedding service interface
 */
export interface IEmbeddingService {
  /**
   * Generate embedding for text
   */
  getEmbedding(text: string): Promise<{ embedding: number[] }>;
} 