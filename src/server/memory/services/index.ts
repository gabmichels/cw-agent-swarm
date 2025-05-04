/**
 * Export memory services
 */

// Client services
export * from './client/types';
export * from './client/embedding-service';

// Memory services
export * from './memory/types';
export * from './memory/memory-service';

// Search services
export * from './search/types';
export * from './search/search-service';

// Service utilities
import { QdrantMemoryClient } from './client/qdrant-client';
import { EmbeddingService } from './client/embedding-service';
import { MemoryService } from './memory/memory-service';
import { SearchService } from './search/search-service';

// Singleton instances
let memoryClientInstance: QdrantMemoryClient | null = null;
let embeddingServiceInstance: EmbeddingService | null = null;
let memoryServiceInstance: MemoryService | null = null;
let searchServiceInstance: SearchService | null = null;

/**
 * Initialize and return memory services
 * Uses singleton pattern to avoid recreating services on each request
 */
export async function getMemoryServices() {
  // Return existing instances if available
  if (memoryClientInstance && embeddingServiceInstance && 
      memoryServiceInstance && searchServiceInstance) {
    return {
      client: memoryClientInstance,
      embeddingService: embeddingServiceInstance,
      memoryService: memoryServiceInstance,
      searchService: searchServiceInstance
    };
  }
  
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
    
    // Create MemoryService
    memoryServiceInstance = new MemoryService(
      memoryClientInstance, 
      embeddingServiceInstance
    );
    
    // Create SearchService
    searchServiceInstance = new SearchService(
      memoryClientInstance,
      embeddingServiceInstance,
      memoryServiceInstance
    );
    
    return {
      client: memoryClientInstance,
      embeddingService: embeddingServiceInstance,
      memoryService: memoryServiceInstance,
      searchService: searchServiceInstance
    };
  } catch (error) {
    console.error('Failed to initialize memory services:', error);
    throw error;
  }
} 