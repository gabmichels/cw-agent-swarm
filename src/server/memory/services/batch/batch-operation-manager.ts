/**
 * Batch Operation Manager
 * 
 * This module implements the batch operation manager for handling batch memory operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseMemoryEntity } from '../../schema/types';
import { IMemoryService } from '../base/types';
import { 
  IBatchOperationManager, 
  IBatchOperation,
  BatchConfig,
  BatchMetadata,
  BatchOperationStatus,
  BatchExecutionStrategy,
  BatchResult
} from './types';
import { Result, successResult, failureResult } from '../../../../lib/errors/base';
import { AppError } from '../../../../lib/errors/base';

/**
 * Error codes for batch operations
 */
export enum BatchErrorCode {
  INVALID_CONFIG = 'BATCH_INVALID_CONFIG',
  OPERATION_FAILED = 'BATCH_OPERATION_FAILED',
  INVALID_STATE = 'BATCH_INVALID_STATE',
  TIMEOUT = 'BATCH_TIMEOUT',
  CANCELLED = 'BATCH_CANCELLED'
}

/**
 * Batch operation implementation
 */
class BatchOperation<T extends BaseMemoryEntity> implements IBatchOperation<T> {
  private status: BatchOperationStatus = BatchOperationStatus.PENDING;
  private result?: BatchResult<T>;
  private isCancelled = false;
  
  constructor(
    private readonly batchId: string,
    private readonly operationType: 'create' | 'update' | 'delete' | 'search',
    private readonly memoryService: IMemoryService<T>,
    private readonly config: BatchConfig,
    private readonly metadata: BatchMetadata
  ) {}
  
  async execute(
    items: T[],
    config: BatchConfig,
    metadata: BatchMetadata
  ): Promise<Result<BatchResult<T>>> {
    if (this.status !== BatchOperationStatus.PENDING) {
      return failureResult(
        new AppError(BatchErrorCode.INVALID_STATE, 'Operation already executed')
      );
    }
    
    if (this.isCancelled) {
      return failureResult(
        new AppError(BatchErrorCode.CANCELLED, 'Operation was cancelled')
      );
    }
    
    this.status = BatchOperationStatus.PROCESSING;
    const startTime = Date.now();
    
    try {
      const results: BatchResult<T>['results'] = [];
      let successfulItems = 0;
      let failedItems = 0;
      
      // Process items based on execution strategy
      switch (config.defaultStrategy) {
        case BatchExecutionStrategy.SEQUENTIAL:
          await this.processSequentially(items, results);
          break;
          
        case BatchExecutionStrategy.PARALLEL:
          await this.processParallel(items, results, config.maxParallelOps);
          break;
          
        case BatchExecutionStrategy.OPTIMIZED:
          await this.processOptimized(items, results, config);
          break;
          
        default:
          return failureResult(
            new AppError(BatchErrorCode.INVALID_CONFIG, 'Invalid execution strategy')
          );
      }
      
      // Calculate statistics
      successfulItems = results.filter(r => r.success).length;
      failedItems = results.filter(r => !r.success).length;
      
      // Determine final status
      this.status = failedItems === 0 
        ? BatchOperationStatus.COMPLETED
        : successfulItems === 0 
          ? BatchOperationStatus.FAILED 
          : BatchOperationStatus.PARTIAL;
      
      // Create result with proper type handling
      const batchResult: BatchResult<T> = {
        batchId: this.batchId,
        status: this.status,
        totalItems: items.length,
        successfulItems,
        failedItems,
        results,
        metadata,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        executionTimeMs: Date.now() - startTime
      };
      
      this.result = batchResult;
      return successResult(batchResult);
    } catch (error) {
      this.status = BatchOperationStatus.FAILED;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      return failureResult(
        new AppError(BatchErrorCode.OPERATION_FAILED, 'Batch operation failed', { 
          message: errorObj.message,
          stack: errorObj.stack,
          name: errorObj.name
        })
      );
    }
  }
  
  async getStatus(batchId: string): Promise<Result<BatchOperationStatus>> {
    if (batchId !== this.batchId) {
      return failureResult(
        new AppError(BatchErrorCode.INVALID_STATE, 'Invalid batch ID')
      );
    }
    return successResult(this.status);
  }
  
  async cancel(): Promise<Result<boolean>> {
    if (this.status === BatchOperationStatus.COMPLETED) {
      return failureResult(
        new AppError(BatchErrorCode.INVALID_STATE, 'Cannot cancel completed operation')
      );
    }
    
    this.isCancelled = true;
    this.status = BatchOperationStatus.FAILED;
    return successResult(true);
  }
  
  async getResult(batchId: string): Promise<Result<BatchResult<T>>> {
    if (batchId !== this.batchId) {
      return failureResult(
        new AppError(BatchErrorCode.INVALID_STATE, 'Invalid batch ID')
      );
    }
    if (!this.result) {
      return failureResult(
        new AppError(BatchErrorCode.INVALID_STATE, 'Operation not executed')
      );
    }
    return successResult(this.result);
  }
  
  private async processSequentially(
    items: T[],
    results: BatchResult<T>['results']
  ): Promise<void> {
    for (const item of items) {
      if (this.isCancelled) break;
      
      try {
        let operationResult: T | undefined = undefined;
        
        switch (this.operationType) {
          case 'create': {
            const createResult = await this.memoryService.create(item, {});
            if (!createResult.success) {
              throw new Error(createResult.error?.message || 'Create operation failed');
            }
            if (createResult.data === null) {
              throw new Error('Create operation returned null data');
            }
            operationResult = createResult.data;
            break;
          }
          case 'update': {
            const updateResult = await this.memoryService.update(item.id, item, {});
            if (!updateResult.success) {
              throw new Error(updateResult.error?.message || 'Update operation failed');
            }
            if (updateResult.data === null) {
              throw new Error('Update operation returned null data');
            }
            operationResult = updateResult.data;
            break;
          }
          case 'delete': {
            const deleteResult = await this.memoryService.delete(item.id, {});
            if (!deleteResult.success) {
              throw new Error(deleteResult.error?.message || 'Delete operation failed');
            }
            break;
          }
          case 'search':
            // Search operations are handled differently
            throw new Error('Search operations not supported in sequential mode');
        }
        
        results.push({
          id: item.id,
          success: true,
          result: operationResult
        });
      } catch (error) {
        results.push({
          id: item.id,
          success: false,
          error: {
            code: 'OPERATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  }
  
  private async processParallel(
    items: T[],
    results: BatchResult<T>['results'],
    maxParallelOps: number
  ): Promise<void> {
    // Process items in chunks to limit parallel operations
    for (let i = 0; i < items.length; i += maxParallelOps) {
      if (this.isCancelled) break;
      
      const chunk = items.slice(i, i + maxParallelOps);
      const chunkResults = await Promise.all(
        chunk.map(async item => {
          try {
            let operationResult: T | undefined = undefined;
            
            switch (this.operationType) {
              case 'create': {
                const createResult = await this.memoryService.create(item, {});
                if (!createResult.success) {
                  throw new Error(createResult.error?.message || 'Create operation failed');
                }
                if (createResult.data === null) {
                  throw new Error('Create operation returned null data');
                }
                operationResult = createResult.data;
                break;
              }
              case 'update': {
                const updateResult = await this.memoryService.update(item.id, item, {});
                if (!updateResult.success) {
                  throw new Error(updateResult.error?.message || 'Update operation failed');
                }
                if (updateResult.data === null) {
                  throw new Error('Update operation returned null data');
                }
                operationResult = updateResult.data;
                break;
              }
              case 'delete': {
                const deleteResult = await this.memoryService.delete(item.id, {});
                if (!deleteResult.success) {
                  throw new Error(deleteResult.error?.message || 'Delete operation failed');
                }
                break;
              }
              case 'search':
                // Search operations are handled differently
                throw new Error('Search operations not supported in parallel mode');
            }
            
            return {
              id: item.id,
              success: true,
              result: operationResult
            };
          } catch (error) {
            return {
              id: item.id,
              success: false,
              error: {
                code: 'OPERATION_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error'
              }
            };
          }
        })
      );
      
      results.push(...chunkResults);
    }
  }
  
  private async processOptimized(
    items: T[],
    results: BatchResult<T>['results'],
    config: BatchConfig
  ): Promise<void> {
    // Group items by operation type for optimized processing
    const groups = new Map<string, T[]>();
    
    items.forEach(item => {
      const key = this.getOptimizationKey(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });
    
    // Process each group using Array.from to iterate over Map entries
    for (const [key, groupItems] of Array.from(groups.entries())) {
      if (this.isCancelled) break;
      
      // Use parallel processing for each group
      await this.processParallel(groupItems, results, config.maxParallelOps);
    }
  }
  
  private getOptimizationKey(item: T): string {
    // Defensive: handle both string and object id
    const idPart = typeof item.id === 'object' && item.id !== null && 'id' in item.id
      ? (item.id as any).id
      : item.id;
    return `${this.operationType}_${idPart}`;
  }
}

/**
 * Batch operation manager implementation
 */
export class BatchOperationManager implements IBatchOperationManager {
  private operations = new Map<string, IBatchOperation<any>>();
  private statistics = {
    totalOperations: 0,
    activeOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    totalExecutionTime: 0
  };
  
  constructor(
    private readonly defaultConfig: BatchConfig,
    private readonly memoryServiceFactory: (collectionName: string) => IMemoryService<any>
  ) {}
  
  createOperation<T extends BaseMemoryEntity>(
    operationType: 'create' | 'update' | 'delete' | 'search',
    config: BatchConfig,
    metadata: BatchMetadata
  ): IBatchOperation<T> {
    const batchId = uuidv4();
    const operation = new BatchOperation<T>(
      batchId,
      operationType,
      this.memoryServiceFactory(metadata.collectionName),
      { ...this.defaultConfig, ...config },
      metadata
    );
    this.operations.set(batchId, operation);
    this.statistics.totalOperations++;
    this.statistics.activeOperations++;

    // Patch the execute method to update stats synchronously
    const originalExecute = operation.execute.bind(operation);
    operation.execute = async (...args: Parameters<typeof operation.execute>) => {
      const result = await originalExecute(...args);
      if (result.success && result.data) {
        this.statistics.activeOperations--;
        if (result.data.status === BatchOperationStatus.COMPLETED) {
          this.statistics.completedOperations++;
        } else if (result.data.status === BatchOperationStatus.FAILED) {
          this.statistics.failedOperations++;
        }
        this.statistics.totalExecutionTime += result.data.executionTimeMs || 0;
      }
      return result;
    };

    return operation;
  }
  
  async getActiveOperations(): Promise<Array<{
    batchId: string;
    operationType: string;
    status: BatchOperationStatus;
    metadata: BatchMetadata;
  }>> {
    const activeOps = [];
    
    // Use Array.from to iterate over Map entries
    for (const [batchId, operation] of Array.from(this.operations.entries())) {
      const statusResult = await operation.getStatus(batchId);
      if (statusResult.success && statusResult.data === BatchOperationStatus.PROCESSING) {
        const result = await operation.getResult(batchId);
        if (result.success && result.data) {
          activeOps.push({
            batchId,
            operationType: result.data.metadata.operationType,
            status: result.data.status,
            metadata: result.data.metadata
          });
        }
      }
    }
    
    return activeOps;
  }
  
  async getStatistics(): Promise<{
    totalOperations: number;
    activeOperations: number;
    completedOperations: number;
    failedOperations: number;
    averageExecutionTime: number;
  }> {
    return {
      ...this.statistics,
      averageExecutionTime: this.statistics.totalOperations > 0
        ? this.statistics.totalExecutionTime / this.statistics.totalOperations
        : 0
    };
  }
} 