/**
 * Base Memory Service
 * 
 * This module provides an abstract base class for memory services.
 * It implements the IMemoryService interface and provides common functionality
 * like error handling and validation.
 */

import { AppError, Result, failureResult, successResult } from '../../../../lib/errors/base';
import { BaseMemoryEntity } from '../../schema/types';
import { CreateOptions, DeleteOptions, IMemoryRepository, IMemoryService, SearchParams, UpdateOptions } from './types';
import { ValidationError } from '../../schema/errors';
import { StructuredId } from '../../../../utils/ulid';

/**
 * Error codes for memory service operations
 */
export enum MemoryErrorCode {
  CREATION_FAILED = 'MEMORY_CREATION_FAILED',
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  UPDATE_FAILED = 'MEMORY_UPDATE_FAILED',
  DELETE_FAILED = 'MEMORY_DELETE_FAILED',
  SEARCH_FAILED = 'MEMORY_SEARCH_FAILED',
  VALIDATION_FAILED = 'MEMORY_VALIDATION_FAILED',
  TRANSACTION_FAILED = 'MEMORY_TRANSACTION_FAILED'
}

/**
 * Base class for memory services
 */
export abstract class BaseMemoryService<T extends BaseMemoryEntity> implements IMemoryService<T> {
  /**
   * Create a new service instance
   */
  constructor(public readonly repository: IMemoryRepository<T>) {}

  /**
   * Create a new memory entity
   */
  async create(
    params: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>,
    options?: CreateOptions
  ): Promise<Result<T>> {
    try {
      const entity = await this.repository.create(params, options);
      return successResult(entity);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.CREATION_FAILED, {
        entityType: this.repository.schema.name,
        operation: 'create'
      });
    }
  }

  /**
   * Get entity by ID
   */
  async getById(id: StructuredId | string): Promise<Result<T | null>> {
    try {
      const entity = await this.repository.getById(id);
      return successResult(entity);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.NOT_FOUND, {
        entityType: this.repository.schema.name,
        entityId: typeof id === 'string' ? id : id.toString(),
        operation: 'getById'
      });
    }
  }

  /**
   * Update entity by ID
   */
  async update(
    id: StructuredId | string,
    updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>>,
    options?: UpdateOptions
  ): Promise<Result<T | null>> {
    try {
      const entity = await this.repository.update(id, updates, options);
      return successResult(entity);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        entityType: this.repository.schema.name,
        entityId: typeof id === 'string' ? id : id.toString(),
        operation: 'update'
      });
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(
    id: StructuredId | string,
    options?: DeleteOptions
  ): Promise<Result<boolean>> {
    try {
      const success = await this.repository.delete(id, options);
      return successResult(success);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.DELETE_FAILED, {
        entityType: this.repository.schema.name,
        entityId: typeof id === 'string' ? id : id.toString(),
        operation: 'delete',
        hardDelete: options?.hardDelete
      });
    }
  }

  /**
   * Search for entities
   */
  async search(params: SearchParams<T>): Promise<Result<T[]>> {
    try {
      // Use text query if provided
      if (params.query) {
        const entities = await this.repository.search(
          params.query,
          {
            limit: params.limit,
            offset: params.offset,
            scoreThreshold: params.scoreThreshold,
            includeDeleted: params.includeDeleted
          }
        );
        return successResult(entities);
      }
      
      // Use vector if provided
      if (params.vector) {
        const entities = await this.repository.searchByVector(
          params.vector,
          {
            limit: params.limit,
            offset: params.offset,
            scoreThreshold: params.scoreThreshold,
            includeDeleted: params.includeDeleted
          }
        );
        return successResult(entities);
      }
      
      // Use filter if provided
      if (params.filter) {
        const entities = await this.repository.filter(
          params.filter,
          {
            limit: params.limit,
            offset: params.offset,
            includeDeleted: params.includeDeleted
          }
        );
        return successResult(entities);
      }
      
      // Get all if no search criteria provided
      const entities = await this.repository.getAll({
        limit: params.limit,
        offset: params.offset,
        includeDeleted: params.includeDeleted
      });
      
      return successResult(entities);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        entityType: this.repository.schema.name,
        operation: 'search',
        query: params.query,
        hasVector: !!params.vector,
        hasFilter: !!params.filter
      });
    }
  }

  /**
   * Execute operation with transaction support
   */
  async withTransaction<R>(
    operation: (repo: IMemoryRepository<T>) => Promise<R>
  ): Promise<Result<R>> {
    try {
      // Execute operation with repository
      // Note: Actual transaction support would be implemented based on the database client
      const result = await operation(this.repository);
      return successResult(result);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.TRANSACTION_FAILED, {
        entityType: this.repository.schema.name,
        operation: 'transaction'
      });
    }
  }

  /**
   * Handle error and convert to result
   */
  protected handleError<R>(
    error: unknown,
    defaultCode: MemoryErrorCode,
    context: Record<string, unknown> = {}
  ): Result<R> {
    // If it's already an AppError, add context and return
    if (error instanceof AppError) {
      return failureResult(error.withContext(context));
    }
    
    // If it's a validation error, return with validation context
    if (error instanceof ValidationError) {
      const validationError = new AppError(
        error.message,
        MemoryErrorCode.VALIDATION_FAILED,
        {
          ...context,
          validationFailures: error.failures || []
        }
      );
      
      return failureResult(validationError);
    }
    
    // For generic errors, create a new AppError
    const message = error instanceof Error ? error.message : String(error);
    const appError = new AppError(
      message,
      defaultCode,
      context
    );
    
    return failureResult(appError);
  }
} 