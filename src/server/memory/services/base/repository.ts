/**
 * Base Memory Repository
 * 
 * This module provides an abstract base class for memory repositories.
 * It implements the IMemoryRepository interface and provides common functionality
 * while requiring subclasses to implement specific mapping logic.
 */

import { CreateOptions, DatabaseRecord, DeleteOptions, FilterConditions, FilterOptions, IEmbeddingService, IMemoryRepository, IVectorDatabaseClient, UpdateOptions } from './types';
import { BaseMemoryEntity, Schema, ValidationResult } from '../../schema/types';
import { AppError } from '../../../../lib/errors/base';
import { StructuredId } from '../../../../utils/ulid';
import { SchemaError, ValidationError } from '../../schema/errors';
import { IdGenerator } from '../../../../utils/ulid';

/**
 * Create a structured ID
 * @deprecated Use IdGenerator.generate('memory') directly
 */
function createStructuredId(): string {
  return IdGenerator.generate('memory');
}

/**
 * Abstract base class for memory repositories
 */
export abstract class BaseMemoryRepository<T extends BaseMemoryEntity> implements IMemoryRepository<T> {
  /**
   * Create a new repository instance
   * @param collectionName Name of the collection
   * @param schema Schema for validation
   * @param databaseClient Vector database client
   * @param embeddingService Service for generating embeddings
   */
  constructor(
    public readonly collectionName: string,
    public readonly schema: Schema<T>,
    protected readonly databaseClient: IVectorDatabaseClient,
    protected readonly embeddingService: IEmbeddingService
  ) {}

  /**
   * Create a new memory entity
   */
  async create(
    entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>,
    options: CreateOptions = {}
  ): Promise<T> {
    // Apply defaults
    const defaults = options.applyDefaults !== false ? this.schema.getDefaults() : {};
    
    // Generate ID if not provided
    const id = createStructuredId();
    
    // Use provided timestamps or current time
    const now = options.createdAt || new Date();
    
    // Create new entity with ID and timestamps
    const newEntity = {
      ...defaults,
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
      schemaVersion: this.schema.version.toString()
    } as T;
    
    // Validate entity if enabled
    if (options.validation?.enabled !== false) {
      const validation = this.schema.validate(newEntity);
      if (!validation.valid) {
        this.handleValidationError(validation, options.validation?.throwOnError !== false);
      }
    }
    
    // Generate embedding for content
    const vector = await this.getEmbeddingForContent(newEntity.content);
    
    // Map to database record
    const record = this.mapToRecord(newEntity, vector);
    
    // Save to database
    await this.databaseClient.addPoint(this.collectionName, record);
    
    return newEntity;
  }

  /**
   * Get entity by ID
   */
  async getById(id: string): Promise<T | null> {
    // Get from database
    const records = await this.databaseClient.getPoints(this.collectionName, [id]);
    
    // Return null if not found
    if (records.length === 0) {
      return null;
    }
    
    // Map to entity
    return this.mapToEntity(records[0]);
  }

  /**
   * Update entity by ID
   */
  async update(
    id: string,
    updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>>,
    options: UpdateOptions = {}
  ): Promise<T | null> {
    // Get existing entity
    const existingEntity = await this.getById(id);
    if (!existingEntity) {
      return null;
    }
    
    // Create updated entity
    const updatedEntity = {
      ...existingEntity,
      ...updates,
      id: existingEntity.id,
      createdAt: existingEntity.createdAt,
      updatedAt: options.updatedAt || new Date(),
    } as T;
    
    // Handle metadata merging
    if (updates.metadata && options.mergeMetadata !== false) {
      updatedEntity.metadata = {
        ...existingEntity.metadata,
        ...updates.metadata
      };
    }
    
    // Validate if enabled
    if (options.validate !== false) {
      const validation = this.schema.validate(updatedEntity);
      if (!validation.valid) {
        this.handleValidationError(validation);
      }
    }
    
    // Prepare database updates
    const dbUpdates: Partial<DatabaseRecord> = {
      payload: this.extractPayload(updatedEntity)
    };
    
    // Update embedding if content changed
    if (updates.content) {
      dbUpdates.vector = await this.getEmbeddingForContent(updates.content);
    }
    
    // Update in database
    const success = await this.databaseClient.updatePoint(
      this.collectionName,
      id,
      dbUpdates
    );
    
    if (!success) {
      return null;
    }
    
    return updatedEntity;
  }

  /**
   * Delete entity by ID
   */
  async delete(
    id: string,
    options: DeleteOptions = {}
  ): Promise<boolean> {
    // Delete from database
    return this.databaseClient.deletePoint(
      this.collectionName,
      id,
      options
    );
  }

  /**
   * Search for entities by text query
   */
  async search(query: string, options?: FilterOptions): Promise<T[]> {
    // Generate embedding
    const vector = await this.getEmbeddingForContent(query);
    
    // Search by vector
    return this.searchByVector(vector, options);
  }

  /**
   * Search by vector directly
   */
  async searchByVector(vector: number[], options?: FilterOptions): Promise<T[]> {
    // Search in database
    const records = await this.databaseClient.searchPoints(
      this.collectionName,
      vector,
      options
    );
    
    // Map to entities
    return Promise.all(records.map(record => this.mapToEntity(record)));
  }

  /**
   * Filter entities by conditions
   */
  async filter(conditions: FilterConditions<T>, options?: FilterOptions): Promise<T[]> {
    // TODO: Implement filter using Qdrant filter builder
    // This will be implemented when the filter builder is ready
    throw new Error('Not implemented');
  }

  /**
   * Get all entities
   */
  async getAll(options?: FilterOptions): Promise<T[]> {
    // TODO: Implement using scroll/scan API
    throw new Error('Not implemented');
  }

  /**
   * Count entities matching conditions
   */
  async count(conditions?: FilterConditions<T>): Promise<number> {
    // TODO: Implement count
    throw new Error('Not implemented');
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    const entity = await this.getById(id);
    return entity !== null;
  }

  /**
   * Map database record to entity
   * Must be implemented by subclasses
   */
  protected abstract mapToEntity(record: DatabaseRecord): T;

  /**
   * Map entity to database record
   */
  protected mapToRecord(entity: T, vector: number[]): DatabaseRecord {
    return {
      id: entity.id,
      vector,
      payload: this.extractPayload(entity)
    };
  }

  /**
   * Extract payload from entity
   */
  protected extractPayload(entity: T): Record<string, unknown> {
    return {
      id: entity.id,
      content: entity.content,
      type: entity.type,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      schemaVersion: entity.schemaVersion,
      metadata: entity.metadata
    };
  }

  /**
   * Generate embedding for content
   */
  protected async getEmbeddingForContent(content: string): Promise<number[]> {
    try {
      const result = await this.embeddingService.getEmbedding(content);
      return result.embedding;
    } catch (error) {
      throw new AppError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
        'EMBEDDING_ERROR',
        { content: content.slice(0, 100) + (content.length > 100 ? '...' : '') }
      );
    }
  }

  /**
   * Handle validation error
   */
  protected handleValidationError(validation: ValidationResult, throwError: boolean = true): void {
    if (!validation.valid && validation.errors && validation.errors.length > 0) {
      if (throwError) {
        throw new ValidationError(
          'Entity validation failed',
          validation.errors
        );
      }
    }
  }
} 