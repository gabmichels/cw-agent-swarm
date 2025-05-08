/**
 * Migration Helpers
 * 
 * Utility functions to assist in migrating from MemoryService to EnhancedMemoryService
 */

import { MemoryService } from '../memory/memory-service';
import { EnhancedMemoryService } from './enhanced-memory-service';
import { IMemoryClient } from '../client/types';
import { EmbeddingService } from '../client/embedding-service';

/**
 * Convert an existing MemoryService instance to an EnhancedMemoryService
 * This is for use in existing code where we can't directly modify the constructor parameters
 * 
 * @param memoryService Existing MemoryService instance
 * @param client Memory client (if available)
 * @param embeddingService Embedding service (if available)
 * @returns EnhancedMemoryService with the same client and embedding service
 * 
 * @throws Error if unable to create EnhancedMemoryService
 */
export function migrateToEnhancedMemoryService(
  memoryService: MemoryService,
  client?: IMemoryClient,
  embeddingService?: EmbeddingService
): EnhancedMemoryService {
  try {
    // Extract the client and embedding service from the MemoryService if not provided
    // Note: This is a bit hacky as it relies on the MemoryService's private properties
    // It's only for migration purposes and should be used with caution
    const actualClient = client || (memoryService as any).client;
    const actualEmbeddingService = embeddingService || (memoryService as any).embeddingService;
    
    if (!actualClient || !actualEmbeddingService) {
      throw new Error('Unable to extract required dependencies from MemoryService');
    }
    
    // Create a new EnhancedMemoryService with the extracted dependencies
    return new EnhancedMemoryService(
      actualClient,
      actualEmbeddingService,
      {
        getTimestamp: (memoryService as any).getTimestamp 
          ? (memoryService as any).getTimestamp 
          : () => Date.now()
      }
    );
  } catch (error) {
    console.error('Failed to migrate to EnhancedMemoryService:', error);
    throw new Error('Migration to EnhancedMemoryService failed');
  }
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
 * Check if a memory service is an EnhancedMemoryService
 * 
 * @param service Memory service instance
 * @returns True if the service is an EnhancedMemoryService
 */
export function isEnhancedMemoryService(service: MemoryService): boolean {
  return service instanceof EnhancedMemoryService;
}

/**
 * Safely cast a MemoryService to EnhancedMemoryService if possible
 * 
 * @param service Memory service instance
 * @returns EnhancedMemoryService or null if not possible
 */
export function asEnhancedMemoryService(service: MemoryService): EnhancedMemoryService | null {
  return isEnhancedMemoryService(service) ? service as EnhancedMemoryService : null;
} 