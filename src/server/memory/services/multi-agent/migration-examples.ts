/**
 * Migration Examples for EnhancedMemoryService
 * 
 * This file contains practical examples of how to migrate from base MemoryService
 * to EnhancedMemoryService in various scenarios.
 */

import { MemoryService } from '../memory/memory-service';
import { EnhancedMemoryService } from './enhanced-memory-service';
import { EmbeddingService } from '../client/embedding-service';
import { IMemoryClient } from '../client/types';
import { MemoryType } from '../../config';
import {
  migrateToEnhancedMemoryService,
  createMigrationManager,
  isEnhancedMemoryService,
  asEnhancedMemoryService,
  createEnhancedMemoryService,
  validateEnhancedMemoryService,
  MigrationConfig,
  MigrationResult
} from './migration-helpers';

/**
 * Example 1: Simple service migration with full setup
 * Use this pattern when you have all required dependencies available
 */
async function migrateExistingServiceExample(
  memoryService: MemoryService,
  memoryClient: IMemoryClient,
  embeddingService: EmbeddingService
): Promise<EnhancedMemoryService> {
  // First check if it's already an EnhancedMemoryService to avoid unnecessary migration
  if (isEnhancedMemoryService(memoryService)) {
    console.log('Service is already an EnhancedMemoryService');
    return memoryService as EnhancedMemoryService;
  }
  
  // If not, migrate the service
  console.log('Migrating to EnhancedMemoryService');
  const migrationResult = await migrateToEnhancedMemoryService(
    memoryService,
    memoryClient,
    embeddingService
  );
  
  // Log migration results
  console.log(`Migration completed: ${migrationResult.successfulMigrations}/${migrationResult.totalProcessed} memories migrated`);
  
  // Create a new enhanced service with the same dependencies
  return createEnhancedMemoryService(memoryClient, embeddingService);
}

/**
 * Example 2: Safe casting with conditional logic
 * Use this pattern when you need to perform different operations based on service type
 */
async function conditionalOperationExample(
  memoryService: MemoryService,
  userId: string,
  content: string
) {
  // Try to upgrade to EnhancedMemoryService
  const enhancedService = asEnhancedMemoryService(memoryService);
  
  if (enhancedService) {
    console.log('Using optimized query with EnhancedMemoryService');
    
    // Use top-level fields for optimization with EnhancedMemoryService
    return enhancedService.addMemory({
      type: MemoryType.DOCUMENT,
      content,
      metadata: {
        userId,
        importance: 'high',
        source: 'user-input'
      }
    });
  } else {
    console.log('Using standard query with base MemoryService');
    
    // Fall back to standard operation with base MemoryService
    return memoryService.addMemory({
      type: MemoryType.DOCUMENT,
      content,
      metadata: {
        userId,
        importance: 'high',
        source: 'user-input'
      }
    });
  }
}

/**
 * Example 3: Creating a new service directly
 * Use this pattern when setting up services from scratch
 */
async function createNewServiceExample(
  client: IMemoryClient,
  embeddingService: EmbeddingService
): Promise<EnhancedMemoryService> {
  
  // Create enhanced service directly
  return createEnhancedMemoryService(
    client,
    embeddingService,
    {
      // Optional custom timestamp function
      getTimestamp: () => Date.now()
    }
  );
}

/**
 * Example 4: Optimized queries using dual-field approach
 * Shows how to take advantage of the optimized query capabilities
 */
async function optimizedQueryExample(
  memoryService: MemoryService,
  memoryClient: IMemoryClient,
  embeddingService: EmbeddingService,
  userId: string,
  chatId: string
) {
  // First try to get an enhanced service
  let enhancedService: EnhancedMemoryService | null = null;
  
  if (isEnhancedMemoryService(memoryService)) {
    enhancedService = memoryService as EnhancedMemoryService;
  } else {
    // Try to migrate on-the-fly
    try {
      const migrationResult = await migrateToEnhancedMemoryService(
        memoryService,
        memoryClient,
        embeddingService
      );
      console.log(`Migration completed: ${migrationResult.successfulMigrations} memories migrated`);
      
      // Create new enhanced service after migration
      enhancedService = createEnhancedMemoryService(memoryClient, embeddingService);
    } catch (error) {
      console.warn('Could not migrate to EnhancedMemoryService:', error);
      // Continue with base service
    }
  }
  
  if (enhancedService) {
    // Use the optimized query approach with top-level fields
    // This will be much faster as these fields are directly accessible
    return enhancedService.searchMemories({
      type: MemoryType.CHAT,
      filter: {
        // These filter conditions will use the top-level indexed fields
        userId,
        chatId,
        // You can also use standard metadata filtering alongside
        metadata: {
          messageType: 'user'
        }
      }
    });
  } else {
    // Fall back to standard filtering approach
    return memoryService.searchMemories({
      type: MemoryType.CHAT,
      filter: {
        // Without EnhancedMemoryService, we need to use nested metadata
        // which is slower for these frequently accessed fields
        metadata: {
          userId,
          chatId,
          messageType: 'user'
        }
      }
    });
  }
}

/**
 * Example 5: Migrating in a class constructor
 * How to upgrade services when initializing a class
 */
class MemoryManager {
  private memoryService: EnhancedMemoryService;
  
  constructor(
    serviceOrClient: MemoryService | IMemoryClient, 
    embeddingService: EmbeddingService,
    memoryClient?: IMemoryClient
  ) {
    // Handle both MemoryService and direct client
    if (serviceOrClient instanceof MemoryService) {
      // We were given a service instance
      if (isEnhancedMemoryService(serviceOrClient)) {
        // Already enhanced
        this.memoryService = serviceOrClient as EnhancedMemoryService;
      } else {
        // Needs migration - but we can't do async in constructor
        // So we create a new enhanced service instead
        if (!memoryClient) {
          throw new Error('Memory client is required when migrating from base MemoryService');
        }
        this.memoryService = createEnhancedMemoryService(memoryClient, embeddingService);
        
        // Note: You would need to call migrateData() separately after construction
        console.warn('Created new EnhancedMemoryService. Call migrateData() to transfer existing data.');
      }
    } else {
      // We were given a client directly
      // Create new enhanced service
      this.memoryService = createEnhancedMemoryService(serviceOrClient, embeddingService);
    }
  }
  
  /**
   * Migrate data from an existing service (call this after constructor if needed)
   */
  async migrateData(
    sourceService: MemoryService,
    config?: Partial<MigrationConfig>
  ): Promise<MigrationResult> {
    if (isEnhancedMemoryService(sourceService)) {
      console.log('Source service is already enhanced, no migration needed');
      return {
        totalProcessed: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        validationErrors: [],
        processingTimeMs: 0,
        idMappings: new Map()
      };
    }
    
    const migrationManager = createMigrationManager(sourceService, this.memoryService, config);
    return await migrationManager.migrateAllMemories();
  }
  
  // Class methods using this.memoryService...
  getService(): EnhancedMemoryService {
    return this.memoryService;
  }
}

/**
 * Example 6: Agent-to-agent communication with EnhancedMemoryService
 * Shows how to use the multi-agent specific fields
 */
async function agentCommunicationExample(
  memoryService: EnhancedMemoryService,
  senderAgentId: string,
  receiverAgentId: string,
  message: string,
  priority: string = 'normal'
) {
  // Create a communication memory with agent-specific fields
  return memoryService.addMemory({
    type: MemoryType.DOCUMENT, // Using DOCUMENT type as a placeholder for agent communication
    content: message,
    metadata: {
      senderAgentId,
      receiverAgentId,
      communicationType: 'direct-message',
      priority,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Example 7: Performance comparison example
 * This shows how to compare performance between regular and enhanced services
 */
async function performanceComparisonExample(
  regularService: MemoryService,
  enhancedService: EnhancedMemoryService,
  userId: string,
  numberOfQueries: number = 10
) {
  console.log('Running performance comparison test...');
  
  // Regular service test
  const regularStart = Date.now();
  
  for (let i = 0; i < numberOfQueries; i++) {
    await regularService.searchMemories({
      type: MemoryType.DOCUMENT,
      filter: {
        metadata: {
          userId
        }
      }
    });
  }
  
  const regularTime = Date.now() - regularStart;
  console.log(`Regular service took ${regularTime}ms for ${numberOfQueries} queries`);
  
  // Enhanced service test
  const enhancedStart = Date.now();
  
  for (let i = 0; i < numberOfQueries; i++) {
    await enhancedService.searchMemories({
      type: MemoryType.DOCUMENT,
      filter: {
        userId // Direct top-level field access
      }
    });
  }
  
  const enhancedTime = Date.now() - enhancedStart;
  console.log(`Enhanced service took ${enhancedTime}ms for ${numberOfQueries} queries`);
  
  // Calculate improvement
  const improvement = (regularTime - enhancedTime) / regularTime * 100;
  console.log(`Performance improvement: ${improvement.toFixed(2)}%`);
  
  return {
    regularTime,
    enhancedTime,
    improvement,
    numberOfQueries
  };
}

export {
  migrateExistingServiceExample,
  conditionalOperationExample,
  createNewServiceExample,
  optimizedQueryExample,
  MemoryManager,
  agentCommunicationExample,
  performanceComparisonExample
}; 