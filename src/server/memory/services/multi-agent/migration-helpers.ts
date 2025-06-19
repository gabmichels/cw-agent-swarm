/**
 * Enhanced Memory Service Migration Helpers
 * 
 * Provides utilities for migrating from base MemoryService to EnhancedMemoryService
 * following architecture refactoring guidelines:
 * - ULID for IDs
 * - Strict type safety
 * - Dependency injection
 * - Pure functions
 * - Proper error handling
 */

import { ulid } from 'ulid';
import { MemoryService } from '../memory/memory-service';
import { EnhancedMemoryService } from './enhanced-memory-service';
import { IMemoryClient } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { MemoryType } from '../../config';
import { createStructuredId, StructuredId } from '../../../../types/entity-identifier';

/**
 * Migration configuration options
 */
export interface MigrationConfig {
  /** Batch size for processing memories */
  batchSize: number;
  /** Whether to preserve original IDs or generate new ULIDs */
  preserveIds: boolean;
  /** Whether to validate data during migration */
  validateData: boolean;
  /** Timeout for individual operations (ms) */
  operationTimeoutMs: number;
  /** Whether to perform dry run (validation only) */
  dryRun: boolean;
}

/**
 * Migration result statistics
 */
export interface MigrationResult {
  /** Total memories processed */
  totalProcessed: number;
  /** Successfully migrated memories */
  successfulMigrations: number;
  /** Failed migrations */
  failedMigrations: number;
  /** Validation errors */
  validationErrors: string[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** IDs that were updated (old -> new mapping) */
  idMappings: Map<string, string>;
}

/**
 * Memory data validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Default migration configuration
 */
export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  batchSize: 100,
  preserveIds: false, // Generate new ULIDs by default
  validateData: true,
  operationTimeoutMs: 30000,
  dryRun: false
};

/**
 * Enhanced Memory Service Migration Manager
 */
export class EnhancedMemoryMigrationManager {
  constructor(
    private readonly sourceService: MemoryService,
    private readonly targetService: EnhancedMemoryService,
    private readonly config: MigrationConfig = DEFAULT_MIGRATION_CONFIG
  ) {}

  /**
   * Migrate all memories from source to target service
   */
  async migrateAllMemories(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      totalProcessed: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      validationErrors: [],
      processingTimeMs: 0,
      idMappings: new Map()
    };

    try {
      // Get all memory types to migrate
      const memoryTypes = Object.values(MemoryType);
      
      for (const type of memoryTypes) {
        const typeResult = await this.migrateMemoriesByType(type);
        
        // Aggregate results
        result.totalProcessed += typeResult.totalProcessed;
        result.successfulMigrations += typeResult.successfulMigrations;
        result.failedMigrations += typeResult.failedMigrations;
        result.validationErrors.push(...typeResult.validationErrors);
        
        // Merge ID mappings
        typeResult.idMappings.forEach((newId, oldId) => {
          result.idMappings.set(oldId, newId);
        });
      }
      
      result.processingTimeMs = Date.now() - startTime;
      return result;
    } catch (error) {
      result.processingTimeMs = Date.now() - startTime;
      result.validationErrors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Migrate memories of a specific type
   */
  async migrateMemoriesByType(type: MemoryType): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalProcessed: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      validationErrors: [],
      processingTimeMs: 0,
      idMappings: new Map()
    };

    try {
      // Get all memories of this type (using search without query to get all)
      const memories = await this.sourceService.searchMemories({
        type,
        limit: 10000 // Large limit to get all memories
      });

      result.totalProcessed = memories.length;

      // Process in batches
      for (let i = 0; i < memories.length; i += this.config.batchSize) {
        const batch = memories.slice(i, i + this.config.batchSize);
        const batchResult = await this.migrateBatch(batch, type);
        
        result.successfulMigrations += batchResult.successfulMigrations;
        result.failedMigrations += batchResult.failedMigrations;
        result.validationErrors.push(...batchResult.validationErrors);
        
        // Merge batch ID mappings
        batchResult.idMappings.forEach((newId, oldId) => {
          result.idMappings.set(oldId, newId);
        });
      }

      return result;
    } catch (error) {
      result.validationErrors.push(`Type migration failed for ${type}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Migrate a batch of memories
   */
  private async migrateBatch<T extends BaseMemorySchema>(
    memories: MemoryPoint<T>[], 
    type: MemoryType
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalProcessed: memories.length,
      successfulMigrations: 0,
      failedMigrations: 0,
      validationErrors: [],
      processingTimeMs: 0,
      idMappings: new Map()
    };

    for (const memory of memories) {
      try {
        // Validate memory data if configured
        if (this.config.validateData) {
          const validation = this.validateMemoryData(memory);
          if (!validation.isValid) {
            result.validationErrors.push(`Memory ${memory.id}: ${validation.errors.join(', ')}`);
            result.failedMigrations++;
            continue;
          }
        }

        // Skip if dry run
        if (this.config.dryRun) {
          result.successfulMigrations++;
          continue;
        }

        // Migrate the memory
        const migrationResult = await this.migrateMemory(memory, type);
        
        if (migrationResult.success) {
          result.successfulMigrations++;
          if (migrationResult.oldId !== migrationResult.newId) {
            result.idMappings.set(migrationResult.oldId, migrationResult.newId);
          }
        } else {
          result.failedMigrations++;
          result.validationErrors.push(`Memory ${memory.id}: ${migrationResult.error}`);
        }
      } catch (error) {
        result.failedMigrations++;
        result.validationErrors.push(`Memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  /**
   * Migrate a single memory
   */
  private async migrateMemory<T extends BaseMemorySchema>(
    memory: MemoryPoint<T>, 
    type: MemoryType
  ): Promise<{ success: boolean; oldId: string; newId: string; error?: string }> {
    try {
      const oldId = memory.id;
      
      // Generate new ID if not preserving original
      const newId = this.config.preserveIds ? oldId : ulid();
      
      // Add to enhanced service
      const addResult = await this.targetService.addMemory({
        id: newId,
        type,
        content: memory.payload.text,
        embedding: memory.vector,
        metadata: memory.payload.metadata || {},
        payload: memory.payload
      });

      if (addResult.success) {
        return { success: true, oldId, newId: addResult.id! };
      } else {
        return { 
          success: false, 
          oldId, 
          newId: oldId, 
          error: addResult.error?.message || 'Unknown error' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        oldId: memory.id, 
        newId: memory.id, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Validate memory data for migration
   */
  private validateMemoryData<T extends BaseMemorySchema>(memory: MemoryPoint<T>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!memory.id) {
      errors.push('Missing memory ID');
    }

    if (!memory.payload?.text) {
      errors.push('Missing memory text content');
    }

    if (!memory.vector || memory.vector.length === 0) {
      errors.push('Missing or empty embedding vector');
    }

    // Check vector dimensions (common embedding dimensions)
    if (memory.vector && ![384, 768, 1024, 1536, 3072].includes(memory.vector.length)) {
      warnings.push(`Unusual embedding dimension: ${memory.vector.length}`);
    }

    // Check for metadata structure
    if (memory.payload?.metadata) {
      const metadata = memory.payload.metadata as any;
      
      // Warn about structured IDs that might need conversion
      if (metadata.userId && typeof metadata.userId === 'string') {
        warnings.push('userId appears to be string instead of structured ID');
      }
      
      if (metadata.agentId && typeof metadata.agentId === 'string') {
        warnings.push('agentId appears to be string instead of structured ID');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Factory function to create migration manager
 */
export function createMigrationManager(
  sourceService: MemoryService,
  targetService: EnhancedMemoryService,
  config?: Partial<MigrationConfig>
): EnhancedMemoryMigrationManager {
  const finalConfig = { ...DEFAULT_MIGRATION_CONFIG, ...config };
  return new EnhancedMemoryMigrationManager(sourceService, targetService, finalConfig);
}

/**
 * Migrate from base MemoryService to EnhancedMemoryService
 * 
 * @param baseService The source MemoryService
 * @param memoryClient Memory client for creating enhanced service
 * @param embeddingService Embedding service for creating enhanced service
 * @param config Migration configuration
 * @returns Promise resolving to migration result
 */
export async function migrateToEnhancedMemoryService(
  baseService: MemoryService,
  memoryClient: IMemoryClient,
  embeddingService: EmbeddingService,
  config?: Partial<MigrationConfig>
): Promise<MigrationResult> {
  // Create enhanced service
  const enhancedService = new EnhancedMemoryService(memoryClient, embeddingService);
  
  // Create migration manager
  const migrationManager = createMigrationManager(baseService, enhancedService, config);
  
  // Perform migration
  return await migrationManager.migrateAllMemories();
}

/**
 * Check if a memory service is an EnhancedMemoryService
 * 
 * @param service Memory service instance
 * @returns True if the service is an EnhancedMemoryService
 */
export function isEnhancedMemoryService(service: MemoryService): service is EnhancedMemoryService {
  return service instanceof EnhancedMemoryService;
}

/**
 * Safely cast a MemoryService to EnhancedMemoryService if possible
 * 
 * @param service Memory service instance
 * @returns EnhancedMemoryService or null if not possible
 */
export function asEnhancedMemoryService(service: MemoryService): EnhancedMemoryService | null {
  return isEnhancedMemoryService(service) ? service : null;
}

/**
 * Create an EnhancedMemoryService from provided dependencies
 * This is a convenience function for tests and other code that need to create an EnhancedMemoryService
 * 
 * @param client Memory client
 * @param embeddingService Embedding service
 * @param options Optional configuration
 * @returns EnhancedMemoryService instance
 */
export function createEnhancedMemoryService(
  client: IMemoryClient,
  embeddingService: EmbeddingService,
  options?: { getTimestamp?: () => number }
): EnhancedMemoryService {
  return new EnhancedMemoryService(client, embeddingService, options);
}

/**
 * Validate that enhanced memory service is properly configured
 */
export function validateEnhancedMemoryService(service: EnhancedMemoryService): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if service is properly instantiated
    if (!service) {
      errors.push('Enhanced memory service is null or undefined');
      return { isValid: false, errors, warnings };
    }

    // Check if it's actually an enhanced service
    if (!isEnhancedMemoryService(service)) {
      errors.push('Service is not an instance of EnhancedMemoryService');
    }

    // Additional validation could be added here
    // (e.g., checking if required dependencies are injected)

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
} 