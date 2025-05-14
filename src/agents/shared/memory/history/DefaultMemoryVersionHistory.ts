/**
 * Default Memory Version History Implementation
 * 
 * This module implements the MemoryVersionHistory interface, providing
 * versioning, comparison, and rollback capabilities for memory entries.
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryManager, MemoryEntry } from '../../../../lib/agents/base/managers/MemoryManager';
import { 
  MemoryVersionHistory, 
  MemoryVersion, 
  MemoryChangeType,
  MemoryDiff,
  RollbackOptions,
  RollbackResult,
  BatchHistoryOptions,
  BatchHistoryResult
} from '../interfaces/MemoryVersionHistory.interface';

/**
 * Configuration options for DefaultMemoryVersionHistory
 */
export interface DefaultMemoryVersionHistoryConfig {
  /**
   * Memory manager to use for memory operations
   */
  memoryManager: MemoryManager;
  
  /**
   * Maximum number of versions to keep per memory entry (0 = unlimited)
   */
  maxVersionsPerMemory?: number;
  
  /**
   * Whether to create versions automatically on memory updates
   */
  autoCreateVersions?: boolean;
  
  /**
   * Logger function
   */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * Error class for memory version history operations
 */
class MemoryVersionHistoryError extends Error {
  constructor(message: string, public readonly code: string = 'MEMORY_VERSION_HISTORY_ERROR') {
    super(message);
    this.name = 'MemoryVersionHistoryError';
  }
}

/**
 * Default implementation of MemoryVersionHistory interface
 */
export class DefaultMemoryVersionHistory implements MemoryVersionHistory {
  private memoryManager: MemoryManager;
  private versions: Map<string, MemoryVersion[]> = new Map();
  private maxVersionsPerMemory: number;
  private autoCreateVersions: boolean;
  private logger: (message: string, data?: unknown) => void;
  
  /**
   * Create a new DefaultMemoryVersionHistory
   * 
   * @param config Configuration options
   */
  constructor(config: DefaultMemoryVersionHistoryConfig) {
    this.memoryManager = config.memoryManager;
    this.maxVersionsPerMemory = config.maxVersionsPerMemory || 0;
    this.autoCreateVersions = config.autoCreateVersions ?? true;
    this.logger = config.logger || console.log;
  }

  /**
   * Create a new version of a memory
   * 
   * @param memoryId ID of the memory
   * @param content Current content of the memory
   * @param changeType Type of change
   * @param metadata Additional metadata
   * @returns Promise resolving to the created version
   */
  async createVersion(
    memoryId: string,
    content: string,
    changeType: MemoryChangeType,
    metadata?: Record<string, unknown>
  ): Promise<MemoryVersion> {
    // Create a new version
    const versionId = `ver_${uuidv4()}`;
    
    // Get previous versions if any
    const existingVersions = this.versions.get(memoryId) || [];
    
    // Get previous version ID if there are existing versions
    const previousVersionId = existingVersions.length > 0
      ? existingVersions[0].versionId // We store versions with newest first
      : undefined;
    
    const version: MemoryVersion = {
      versionId,
      memoryId,
      changeType,
      timestamp: new Date(),
      content,
      metadata: metadata || {},
      changedBy: metadata?.changedBy as string,
      reason: metadata?.reason as string,
      previousVersionId
    };
    
    // Add the new version at the beginning (newest first)
    const updatedVersions = [version, ...existingVersions];
    
    // Apply version limit if set
    const limitedVersions = this.maxVersionsPerMemory > 0
      ? updatedVersions.slice(0, this.maxVersionsPerMemory)
      : updatedVersions;
    
    // Update the versions map
    this.versions.set(memoryId, limitedVersions);
    
    this.logger('Created memory version', {
      memoryId,
      versionId,
      changeType,
      versionsCount: limitedVersions.length
    });
    
    return version;
  }
  
  /**
   * Get all versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param options Query options
   * @returns Promise resolving to memory versions
   */
  async getVersions(
    memoryId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<MemoryVersion[]> {
    const versions = this.versions.get(memoryId) || [];
    
    // Apply sort direction (default is 'desc' - newest first)
    const sortDirection = options?.sortDirection || 'desc';
    let sortedVersions = [...versions];
    
    if (sortDirection === 'asc') {
      // Reverse the array to get oldest first
      sortedVersions = sortedVersions.reverse();
    }
    
    // Apply offset and limit
    const offset = options?.offset || 0;
    const limit = options?.limit || sortedVersions.length;
    
    return sortedVersions.slice(offset, offset + limit);
  }
  
  /**
   * Get a specific version of a memory
   * 
   * @param memoryId ID of the memory
   * @param versionId ID of the version
   * @returns Promise resolving to the memory version
   */
  async getVersion(
    memoryId: string,
    versionId: string
  ): Promise<MemoryVersion | null> {
    const versions = this.versions.get(memoryId) || [];
    return versions.find(v => v.versionId === versionId) || null;
  }
  
  /**
   * Roll back a memory to a previous version
   * 
   * @param memoryId ID of the memory to roll back
   * @param options Rollback options
   * @returns Promise resolving to rollback result
   */
  async rollbackToVersion(
    memoryId: string,
    options: RollbackOptions
  ): Promise<RollbackResult> {
    try {
      // Find the target version
      const targetVersion = await this.getVersion(memoryId, options.targetVersionId);
      if (!targetVersion) {
        throw new MemoryVersionHistoryError(
          `Target version ${options.targetVersionId} not found for memory ${memoryId}`,
          'VERSION_NOT_FOUND'
        );
      }
      
      // Get the current memory entry
      const memories = await this.memoryManager.searchMemories(`id:${memoryId}`, { limit: 1 });
      const memory = memories.length > 0 ? memories[0] : null;
      
      if (!memory) {
        throw new MemoryVersionHistoryError(
          `Memory ${memoryId} not found`,
          'MEMORY_NOT_FOUND'
        );
      }
      
      let resultMemoryId = memoryId;
      let resultMemoryEntry: MemoryEntry | undefined;
      
      // Either create a new memory or update the existing one
      if (options.createNewEntry) {
        // Create a new memory entry with the content from the target version
        const newMemory = await this.memoryManager.addMemory(targetVersion.content, {
          ...memory.metadata,
          originalMemoryId: memoryId,
          rolledBackFrom: options.targetVersionId,
          rollbackReason: options.reason,
          rolledBackBy: options.initiatedBy,
          ...options.metadata
        });
        
        resultMemoryId = newMemory.id;
        resultMemoryEntry = newMemory;
      } else {
        // Since MemoryManager doesn't have update or remove methods, we're limited in our options
        // We'll create a new memory entry that captures the restore operation
        const rollbackMemory = await this.memoryManager.addMemory(targetVersion.content, {
          parentMemoryId: memoryId,
          isRollback: true,
          targetVersion: options.targetVersionId,
          rolledBackTo: options.targetVersionId,
          rollbackReason: options.reason,
          rolledBackBy: options.initiatedBy,
          rollbackTimestamp: new Date().toISOString(),
          ...options.metadata
        });
        
        resultMemoryId = rollbackMemory.id;
        resultMemoryEntry = rollbackMemory;
        
        this.logger('Created new memory for rollback', {
          originalMemoryId: memoryId,
          newMemoryId: resultMemoryId,
          targetVersionId: options.targetVersionId
        });
      }
      
      // Create a new version to record the rollback
      const rollbackMetadata = {
        rollbackToVersion: options.targetVersionId,
        reason: options.reason,
        changedBy: options.initiatedBy,
        createNewEntry: options.createNewEntry || true, // We always end up creating a new entry
        ...options.metadata
      };
      
      const newVersion = await this.createVersion(
        resultMemoryId,
        targetVersion.content,
        MemoryChangeType.RESTORED,
        rollbackMetadata
      );
      
      return {
        success: true,
        memoryId: resultMemoryId,
        newVersionId: newVersion.versionId,
        previousVersionId: options.targetVersionId,
        memoryEntry: resultMemoryEntry
      };
    } catch (error) {
      this.logger('Error rolling back memory version', {
        memoryId,
        targetVersionId: options.targetVersionId,
        error
      });
      
      return {
        success: false,
        memoryId,
        newVersionId: '',
        previousVersionId: options.targetVersionId,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Compare two versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param firstVersionId ID of the first version
   * @param secondVersionId ID of the second version
   * @returns Promise resolving to the difference between versions
   */
  async compareVersions(
    memoryId: string,
    firstVersionId: string,
    secondVersionId: string
  ): Promise<MemoryDiff> {
    // Get the two versions
    const firstVersion = await this.getVersion(memoryId, firstVersionId);
    const secondVersion = await this.getVersion(memoryId, secondVersionId);
    
    if (!firstVersion || !secondVersion) {
      throw new MemoryVersionHistoryError(
        `One or both versions not found: ${firstVersionId}, ${secondVersionId}`,
        'VERSION_NOT_FOUND'
      );
    }
    
    // Create a simple diff by comparing lines
    const firstLines = firstVersion.content.split('\n');
    const secondLines = secondVersion.content.split('\n');
    
    const changes: Array<{
      type: 'added' | 'removed' | 'changed';
      content: string;
      lineNumber?: number;
    }> = [];
    
    // Find removed or changed lines
    for (let i = 0; i < firstLines.length; i++) {
      const firstLine = firstLines[i];
      const secondLine = i < secondLines.length ? secondLines[i] : undefined;
      
      if (secondLine === undefined) {
        // Line was removed
        changes.push({ type: 'removed', content: firstLine, lineNumber: i + 1 });
      } else if (firstLine !== secondLine) {
        // Line was changed
        changes.push({ type: 'changed', content: `${firstLine} -> ${secondLine}`, lineNumber: i + 1 });
      }
    }
    
    // Find added lines
    for (let i = firstLines.length; i < secondLines.length; i++) {
      changes.push({ type: 'added', content: secondLines[i], lineNumber: i + 1 });
    }
    
    return {
      memoryId,
      firstVersionId,
      secondVersionId,
      changes,
      isComplete: true
    };
  }
  
  /**
   * Perform batch operations on memory history
   * 
   * @param operation Operation to perform ('rollback', 'delete', etc.)
   * @param options Batch operation options
   * @returns Promise resolving to batch operation result
   */
  async batchHistoryOperation(
    operation: string,
    options: BatchHistoryOptions
  ): Promise<BatchHistoryResult> {
    if (options.memoryIds.length === 0) {
      return {
        success: true,
        results: [],
        successCount: 0,
        failureCount: 0
      };
    }
    
    // Set default options
    const maxConcurrent = options.maxConcurrent || 5;
    const abortOnError = options.abortOnError || false;
    
    const results: Record<string, unknown>[] = [];
    const errors: Record<string, string> = {};
    let successCount = 0;
    let failureCount = 0;
    
    // Process in batches to avoid overwhelming resources
    const batches: string[][] = [];
    for (let i = 0; i < options.memoryIds.length; i += maxConcurrent) {
      batches.push(options.memoryIds.slice(i, i + maxConcurrent));
    }
    
    // Process each batch
    for (const batch of batches) {
      try {
        // Create promises for each memory ID in the batch
        const batchPromises = batch.map(async (memoryId) => {
          try {
            let result: Record<string, unknown>;
            
            switch (operation) {
              case 'rollback': {
                // Properly handle rollback options
                if (!options.operationOptions?.targetVersionId) {
                  throw new MemoryVersionHistoryError(
                    'targetVersionId is required for rollback operations',
                    'MISSING_TARGET_VERSION'
                  );
                }
                
                // Extract required properties and create a properly typed object
                const rollbackOptions: RollbackOptions = {
                  targetVersionId: options.operationOptions.targetVersionId as string
                };
                
                // Add optional properties if they exist
                if (options.operationOptions.createNewEntry !== undefined) {
                  rollbackOptions.createNewEntry = options.operationOptions.createNewEntry as boolean;
                }
                
                if (options.operationOptions.reason !== undefined) {
                  rollbackOptions.reason = options.operationOptions.reason as string;
                }
                
                if (options.operationOptions.initiatedBy !== undefined) {
                  rollbackOptions.initiatedBy = options.operationOptions.initiatedBy as string;
                }
                
                if (options.operationOptions.metadata !== undefined) {
                  rollbackOptions.metadata = options.operationOptions.metadata as Record<string, unknown>;
                }
                
                const rollbackResult = await this.rollbackToVersion(memoryId, rollbackOptions);
                result = rollbackResult as unknown as Record<string, unknown>;
                break;
              }
                
              case 'delete_history':
                // Delete all version history for this memory
                this.versions.delete(memoryId);
                result = { memoryId, deleted: true };
                break;
                
              case 'delete_version': {
                if (!options.operationOptions?.versionId) {
                  throw new MemoryVersionHistoryError(
                    'versionId is required for delete_version operations',
                    'MISSING_VERSION_ID'
                  );
                }
                
                const versions = this.versions.get(memoryId) || [];
                const filteredVersions = versions.filter(
                  v => v.versionId !== options.operationOptions!.versionId
                );
                
                if (versions.length === filteredVersions.length) {
                  // Version not found
                  throw new MemoryVersionHistoryError(
                    `Version ${options.operationOptions.versionId} not found for memory ${memoryId}`,
                    'VERSION_NOT_FOUND'
                  );
                }
                
                this.versions.set(memoryId, filteredVersions);
                result = { memoryId, versionId: options.operationOptions.versionId, deleted: true };
                break;
              }
                
              default:
                throw new MemoryVersionHistoryError(
                  `Unsupported operation: ${operation}`,
                  'UNSUPPORTED_OPERATION'
                );
            }
            
            successCount++;
            return result;
          } catch (error) {
            failureCount++;
            
            // Record the error
            errors[memoryId] = error instanceof Error ? error.message : String(error);
            
            // If abortOnError is true, rethrow the error to abort the batch
            if (abortOnError) {
              throw error;
            }
            
            // Otherwise, return the error for this memory
            return { 
              memoryId, 
              error: error instanceof Error ? error.message : String(error),
              success: false
            };
          }
        });
        
        // Wait for all operations in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Explicitly type the results as Record<string, unknown>[]
        for (const result of batchResults) {
          results.push(result);
        }
        
        // If any operations failed and abortOnError is true, abort the operation
        if (abortOnError && Object.keys(errors).length > 0) {
          break;
        }
      } catch (error) {
        // If an error occurred and abortOnError is true, abort the operation
        if (abortOnError) {
          this.logger('Aborting batch operation due to error', {
            operation,
            error
          });
          
          break;
        }
      }
    }
    
    return {
      success: failureCount === 0,
      results,
      successCount,
      failureCount,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    };
  }
} 