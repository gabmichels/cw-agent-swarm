/**
 * Batch Operations Types
 * 
 * This module defines types and interfaces for batch memory operations.
 */

import { BaseMemoryEntity } from '../../schema/types';
import { StructuredId } from '../../../../utils/ulid';
import { Result } from '../../../../lib/errors/base';

/**
 * Batch operation status
 */
export enum BatchOperationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

/**
 * Batch operation priority levels
 */
export enum BatchPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Batch operation execution strategy
 */
export enum BatchExecutionStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  OPTIMIZED = 'optimized'
}

/**
 * Batch operation configuration
 */
export interface BatchConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  
  /** Maximum parallel operations */
  maxParallelOps: number;
  
  /** Default execution strategy */
  defaultStrategy: BatchExecutionStrategy;
  
  /** Default priority */
  defaultPriority: BatchPriority;
  
  /** Timeout in milliseconds */
  timeoutMs: number;
  
  /** Retry configuration */
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffFactor: number;
  };
}

/**
 * Batch operation metadata
 */
export interface BatchMetadata {
  /** Operation type */
  operationType: 'create' | 'update' | 'delete' | 'search';
  
  /** Collection name */
  collectionName: string;
  
  /** Operation-specific metadata */
  operationMetadata?: Record<string, unknown>;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Batch operation result
 */
export interface BatchResult<T extends BaseMemoryEntity> {
  /** Batch ID */
  batchId: string;
  
  /** Operation status */
  status: BatchOperationStatus;
  
  /** Total items processed */
  totalItems: number;
  
  /** Successfully processed items */
  successfulItems: number;
  
  /** Failed items */
  failedItems: number;
  
  /** Results for each item */
  results: Array<{
    id: StructuredId;
    success: boolean;
    result?: T;
    error?: {
      code: string;
      message: string;
    };
  }>;
  
  /** Batch metadata */
  metadata: BatchMetadata;
  
  /** Start time */
  startedAt: Date;
  
  /** End time */
  completedAt?: Date;
  
  /** Execution time in milliseconds */
  executionTimeMs?: number;
}

/**
 * Batch operation interface
 */
export interface IBatchOperation<T extends BaseMemoryEntity> {
  /**
   * Execute batch operation
   * @param items Items to process
   * @param config Operation configuration
   * @param metadata Operation metadata
   * @returns Batch operation result
   */
  execute(
    items: T[],
    config: BatchConfig,
    metadata: BatchMetadata
  ): Promise<Result<BatchResult<T>>>;
  
  /**
   * Get operation status
   * @param batchId Batch operation ID
   * @returns Current status
   */
  getStatus(batchId: string): Promise<Result<BatchOperationStatus>>;
  
  /**
   * Cancel batch operation
   * @param batchId Batch operation ID
   * @returns Success status
   */
  cancel(batchId: string): Promise<Result<boolean>>;
  
  /**
   * Get batch operation result
   * @param batchId Batch operation ID
   * @returns Batch operation result
   */
  getResult(batchId: string): Promise<Result<BatchResult<T>>>;
}

/**
 * Batch operation manager interface
 */
export interface IBatchOperationManager {
  /**
   * Create new batch operation
   * @param operationType Operation type
   * @param config Operation configuration
   * @param metadata Operation metadata
   * @returns Batch operation instance
   */
  createOperation<T extends BaseMemoryEntity>(
    operationType: 'create' | 'update' | 'delete' | 'search',
    config: BatchConfig,
    metadata: BatchMetadata
  ): IBatchOperation<T>;
  
  /**
   * Get active batch operations
   * @returns List of active batch operations
   */
  getActiveOperations(): Promise<Array<{
    batchId: string;
    operationType: string;
    status: BatchOperationStatus;
    metadata: BatchMetadata;
  }>>;
  
  /**
   * Get batch operation statistics
   * @returns Operation statistics
   */
  getStatistics(): Promise<{
    totalOperations: number;
    activeOperations: number;
    completedOperations: number;
    failedOperations: number;
    averageExecutionTime: number;
  }>;
} 