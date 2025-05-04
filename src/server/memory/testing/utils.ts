/**
 * Aggregated testing utilities for memory system
 * 
 * This file exports components from individual utility modules to provide
 * a single import point for tests.
 */

// Re-export the MockEmbeddingService
export { MockEmbeddingService } from './utils/mock-embedding-service';

// Re-export the MockMemoryClient
export { MockMemoryClient } from './utils/mock-memory-client';

// Re-export test data generators
export { 
  generateMemoryPoint,
  generateMemoryPoints,
  generateTestMemoryDataset,
  generateQueryText
} from './utils/test-data-generator'; 