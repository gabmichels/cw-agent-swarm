/**
 * Export memory services
 */

// Client services
export * from './client/types';
export * from './client/embedding-service';
export * from './client/vector-db-adapter';

// Memory services
export * from './memory/types';
export * from './memory/memory-service';

// Enhanced Memory services
export * from './multi-agent/enhanced-memory-service';

// Search services
export * from './search/types';
export * from './search/search-service';

// Query optimization services
export * from './query/types';
export * from './query/query-optimizer';

// Import query optimization types
import { QueryOptimizationStrategy } from './query/types';

// Filter services - use explicit re-export to avoid ambiguity
import type { FilterOperator, FilterCondition } from './filters/types';
export type { FilterOperator, FilterCondition };
// Do not re-export FilterOptions as it would conflict with the one from search/types

// Import cache manager
import { DummyCacheManager } from './cache/dummy-cache-manager';

// Service utilities
import { QdrantMemoryClient } from './client/qdrant-client';
import { EmbeddingService } from './client/embedding-service';
import { VectorDatabaseAdapter } from './client/vector-db-adapter';
import { MemoryService } from './memory/memory-service';
import { EnhancedMemoryService } from './multi-agent/enhanced-memory-service';
import { SearchService } from './search/search-service';
import { QueryOptimizer } from './query/query-optimizer';
import { QdrantFilterBuilder } from './filters/filter-builder';

// Singleton instances
let memoryClientInstance: QdrantMemoryClient | null = null;
let embeddingServiceInstance: EmbeddingService | null = null;
let memoryServiceInstance: EnhancedMemoryService | null = null;
let searchServiceInstance: SearchService | null = null;
let queryOptimizerInstance: QueryOptimizer | null = null;
let filterBuilderInstance: QdrantFilterBuilder | null = null;
let vectorDbAdapterInstance: VectorDatabaseAdapter | null = null;

// Initialization lock to prevent race conditions
let initializationPromise: Promise<any> | null = null;

/**
 * Initialize and return memory services
 * Uses singleton pattern to avoid recreating services on each request
 */
export async function getMemoryServices() {
  // Return existing instances if available and fully initialized
  if (memoryClientInstance && embeddingServiceInstance &&
    memoryServiceInstance && searchServiceInstance &&
    queryOptimizerInstance && memoryClientInstance.isInitialized()) {
    return {
      client: memoryClientInstance,
      embeddingService: embeddingServiceInstance,
      memoryService: memoryServiceInstance,
      searchService: searchServiceInstance,
      queryOptimizer: queryOptimizerInstance
    };
  }

  // If already initializing, wait for that to complete
  if (initializationPromise) {
    console.log('Memory services already initializing, waiting...');
    return await initializationPromise;
  }

  // Start initialization and cache the promise
  initializationPromise = (async () => {
    try {
      // Create QdrantMemoryClient
      memoryClientInstance = new QdrantMemoryClient({
        qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
        qdrantApiKey: process.env.QDRANT_API_KEY
      });

      // Create EmbeddingService
      embeddingServiceInstance = new EmbeddingService({
        openAIApiKey: process.env.OPENAI_API_KEY,
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        useRandomFallback: true
      });

      // Initialize client
      await memoryClientInstance.initialize();

      // Ensure getCollectionInfo method is available
      if (memoryClientInstance && typeof memoryClientInstance.getCollectionInfo !== 'function') {
        console.log('Adding getCollectionInfo method to client instance');
        // Add getCollectionInfo method directly using Object.defineProperty to avoid private property access issues
        Object.defineProperty(memoryClientInstance, 'getCollectionInfo', {
          value: async function (collectionName: string) {
            // Skip initialization check since we've already initialized

            try {
              // Check if collection exists - use the existing public method
              if (!memoryClientInstance) {
                return null;
              }

              const exists = await memoryClientInstance.collectionExists(collectionName);
              if (!exists) {
                return null;
              }

              // Access the client using a workaround
              const client = (memoryClientInstance as any).client;
              if (!client) {
                console.error('Unable to access Qdrant client');
                return null;
              }

              // Get collection info from Qdrant
              const info = await client.getCollection(collectionName);
              let dimensions = 1536; // Default

              if (info.config?.params?.vectors) {
                const vectorsConfig = info.config.params.vectors as Record<string, unknown>;
                if (typeof vectorsConfig === 'object' && !Array.isArray(vectorsConfig)) {
                  const vectorNames = Object.keys(vectorsConfig);
                  if (vectorNames.length > 0) {
                    const firstVectorName = vectorNames[0];
                    const firstVectorConfig = vectorsConfig[firstVectorName] as Record<string, unknown> | undefined;
                    if (firstVectorConfig && typeof firstVectorConfig === 'object' && 'size' in firstVectorConfig) {
                      dimensions = (firstVectorConfig.size as number) || 1536;
                    }
                  }
                }
              }

              return {
                name: collectionName,
                dimensions,
                pointsCount: info.vectors_count || 0,
                createdAt: new Date()
              };
            } catch (error) {
              console.error('Error in getCollectionInfo:', error);
              return null;
            }
          },
          writable: false,
          configurable: true,
          enumerable: true
        });
      }

      // Create filter builder
      filterBuilderInstance = new QdrantFilterBuilder();

      // Create vector database adapter
      vectorDbAdapterInstance = new VectorDatabaseAdapter(memoryClientInstance);

      // Create embedding wrapper for query optimizer
      const embeddingWrapper = {
        embedText: async (text: string) => {
          if (!embeddingServiceInstance) {
            throw new Error("Embedding service not initialized");
          }
          const result = await embeddingServiceInstance.getEmbedding(text);
          return result.embedding;
        }
      };

      // Create query optimizer
      queryOptimizerInstance = new QueryOptimizer(
        vectorDbAdapterInstance,
        filterBuilderInstance,
        embeddingWrapper,
        new DummyCacheManager(),
        {
          defaultStrategy: QueryOptimizationStrategy.BALANCED,
          defaultLimit: 10,
          defaultMinScore: 0.6,
          timeoutMs: 1000,
          enableCaching: false,
          cacheTtlSeconds: 300
        }
      );

      // Create EnhancedMemoryService instead of base MemoryService
      memoryServiceInstance = new EnhancedMemoryService(
        memoryClientInstance,
        embeddingServiceInstance
      );

      // Create SearchService with query optimizer
      // We'll pass the query optimizer separately to avoid type errors
      searchServiceInstance = new SearchService(
        memoryClientInstance,
        embeddingServiceInstance,
        memoryServiceInstance
      );

      // Attach the query optimizer to the search service if it has support for it
      if (searchServiceInstance && 'setQueryOptimizer' in searchServiceInstance) {
        (searchServiceInstance as any).setQueryOptimizer(queryOptimizerInstance);
      }

      return {
        client: memoryClientInstance,
        embeddingService: embeddingServiceInstance,
        memoryService: memoryServiceInstance,
        searchService: searchServiceInstance,
        queryOptimizer: queryOptimizerInstance
      };
    } catch (error) {
      console.error('Failed to initialize memory services:', error);
      // Reset instances and promise on error
      memoryClientInstance = null;
      embeddingServiceInstance = null;
      memoryServiceInstance = null;
      searchServiceInstance = null;
      queryOptimizerInstance = null;
      initializationPromise = null;
      throw error;
    }
  })();

  return await initializationPromise;
} 