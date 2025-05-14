/**
 * Memory Version History Interface
 * 
 * This module defines interfaces and types for managing memory version history
 * and implementing rollback functionality.
 */

import { MemoryEntry } from '../../../../lib/agents/base/managers/MemoryManager';

/**
 * Type of change made to a memory entry
 */
export enum MemoryChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  RESTORED = 'restored'
}

/**
 * Representation of a memory version
 */
export interface MemoryVersion {
  /**
   * ID of this version
   */
  versionId: string;
  
  /**
   * ID of the memory entry
   */
  memoryId: string;
  
  /**
   * Type of change
   */
  changeType: MemoryChangeType;
  
  /**
   * Timestamp when this version was created
   */
  timestamp: Date;
  
  /**
   * The memory content for this version
   */
  content: string;
  
  /**
   * Metadata associated with this version
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Who made the change
   */
  changedBy?: string;
  
  /**
   * Reason for the change, if provided
   */
  reason?: string;
  
  /**
   * Reference to previous version, if any
   */
  previousVersionId?: string;
}

/**
 * Result of a diff between two memory versions
 */
export interface MemoryDiff {
  /**
   * Memory ID
   */
  memoryId: string;
  
  /**
   * ID of the first version being compared
   */
  firstVersionId: string;
  
  /**
   * ID of the second version being compared
   */
  secondVersionId: string;
  
  /**
   * Changes from first to second version
   */
  changes: Array<{
    type: 'added' | 'removed' | 'changed';
    content: string;
    lineNumber?: number;
  }>;
  
  /**
   * Whether the diff is complete
   */
  isComplete: boolean;
}

/**
 * Options for rolling back a memory to a previous version
 */
export interface RollbackOptions {
  /**
   * Version ID to roll back to
   */
  targetVersionId: string;
  
  /**
   * Whether to create a new memory entry instead of updating the existing one
   */
  createNewEntry?: boolean;
  
  /**
   * Reason for the rollback
   */
  reason?: string;
  
  /**
   * Who initiated the rollback
   */
  initiatedBy?: string;
  
  /**
   * Additional metadata for the rollback
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a memory rollback operation
 */
export interface RollbackResult {
  /**
   * Whether the rollback was successful
   */
  success: boolean;
  
  /**
   * Memory ID after rollback (may be different if createNewEntry was true)
   */
  memoryId: string;
  
  /**
   * New version ID created during rollback
   */
  newVersionId: string;
  
  /**
   * Previous version ID that was rolled back to
   */
  previousVersionId: string;
  
  /**
   * Any error that occurred during rollback
   */
  error?: string;
  
  /**
   * The rolled back memory entry
   */
  memoryEntry?: MemoryEntry;
}

/**
 * Options for batch operations on memory history
 */
export interface BatchHistoryOptions {
  /**
   * IDs of memories to operate on
   */
  memoryIds: string[];
  
  /**
   * Maximum number of operations to process in parallel
   */
  maxConcurrent?: number;
  
  /**
   * Whether to abort the entire batch if any operation fails
   */
  abortOnError?: boolean;
  
  /**
   * Additional operation-specific options
   */
  operationOptions?: Record<string, unknown>;
}

/**
 * Result of batch operations on memory history
 */
export interface BatchHistoryResult {
  /**
   * Overall success status
   */
  success: boolean;
  
  /**
   * Results for each memory
   */
  results: Record<string, unknown>[];
  
  /**
   * Count of successful operations
   */
  successCount: number;
  
  /**
   * Count of failed operations
   */
  failureCount: number;
  
  /**
   * Errors that occurred, keyed by memory ID
   */
  errors?: Record<string, string>;
}

/**
 * Interface for memory version history management
 */
export interface MemoryVersionHistory {
  /**
   * Create a new version of a memory
   * 
   * @param memoryId ID of the memory
   * @param content Current content of the memory
   * @param changeType Type of change
   * @param metadata Additional metadata
   * @returns Promise resolving to the created version
   */
  createVersion(
    memoryId: string,
    content: string,
    changeType: MemoryChangeType,
    metadata?: Record<string, unknown>
  ): Promise<MemoryVersion>;
  
  /**
   * Get all versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param options Query options
   * @returns Promise resolving to memory versions
   */
  getVersions(
    memoryId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<MemoryVersion[]>;
  
  /**
   * Get a specific version of a memory
   * 
   * @param memoryId ID of the memory
   * @param versionId ID of the version
   * @returns Promise resolving to the memory version
   */
  getVersion(
    memoryId: string,
    versionId: string
  ): Promise<MemoryVersion | null>;
  
  /**
   * Roll back a memory to a previous version
   * 
   * @param memoryId ID of the memory to roll back
   * @param options Rollback options
   * @returns Promise resolving to rollback result
   */
  rollbackToVersion(
    memoryId: string,
    options: RollbackOptions
  ): Promise<RollbackResult>;
  
  /**
   * Compare two versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param firstVersionId ID of the first version
   * @param secondVersionId ID of the second version
   * @returns Promise resolving to the difference between versions
   */
  compareVersions(
    memoryId: string,
    firstVersionId: string,
    secondVersionId: string
  ): Promise<MemoryDiff>;
  
  /**
   * Perform batch operations on memory history
   * 
   * @param operation Operation to perform ('rollback', 'delete', etc.)
   * @param options Batch operation options
   * @returns Promise resolving to batch operation result
   */
  batchHistoryOperation(
    operation: string,
    options: BatchHistoryOptions
  ): Promise<BatchHistoryResult>;
} 