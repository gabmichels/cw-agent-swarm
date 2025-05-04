/**
 * Performance tests for memory system
 * 
 * These tests measure the performance of key memory operations.
 * For meaningful results, run these tests in a controlled environment.
 */

import { describe, test, beforeAll, afterAll } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { generateMemoryPoints } from '../utils/test-data-generator';

// Performance test configuration
const PERFORMANCE_TEST_CONFIG = {
  // Set to true to enable full performance tests
  enabled: process.env.RUN_PERFORMANCE_TESTS === 'true',
  // Number of test items to use
  smallBatchSize: 10,
  mediumBatchSize: 100,
  largeBatchSize: 1000,
  // Number of iterations for each test
  iterations: 3,
  // Timeouts
  timeout: 60000, // 60 seconds
};

/**
 * Simple performance measurement utility
 */
async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>,
  iterations: number = 1
): Promise<{ result: T, averageTime: number }> {
  console.log(`Running performance test: ${name}`);
  
  let totalTime = 0;
  let result: T | undefined;
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    result = await operation();
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    totalTime += elapsed;
    console.log(`  Iteration ${i + 1}/${iterations}: ${elapsed}ms`);
  }
  
  const averageTime = totalTime / iterations;
  console.log(`  Average time: ${averageTime.toFixed(2)}ms`);
  
  return { result: result as T, averageTime };
}

// Only run these tests if explicitly enabled
(PERFORMANCE_TEST_CONFIG.enabled ? describe : describe.skip)('Memory System Performance', () => {
  let client: QdrantMemoryClient;
  let embeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;
  const testCollectionPrefix = `perf_test_${Date.now()}`;
  
  // Use mock embedding service for predictable performance
  beforeAll(async () => {
    // Initialize services with mock embedding service for controlled testing
    embeddingService = new MockEmbeddingService();
    
    client = new QdrantMemoryClient({
      qdrantUrl: process.env.TEST_QDRANT_URL || 'http://localhost:6333',
      // No need for API key with the mock embedding service
    });
    
    await client.initialize();
    
    // @ts-ignore - MockEmbeddingService is compatible enough with EmbeddingService for testing
    memoryService = new MemoryService(client, embeddingService);
    // @ts-ignore - MockEmbeddingService is compatible enough with EmbeddingService for testing
    searchService = new SearchService(client, embeddingService, memoryService);
  }, PERFORMANCE_TEST_CONFIG.timeout);
  
  afterAll(async () => {
    // Clean up all test collections
    // This would delete collections created during testing
    // In a real implementation, this would use client.deleteCollection() 
    // if it exists
  });
  
  describe('Memory addition performance', () => {
    test('should measure performance of adding small batch of memories', async () => {
      // Generate test data
      const memories = generateMemoryPoints(
        PERFORMANCE_TEST_CONFIG.smallBatchSize,
        MemoryType.MESSAGE,
        { baseContent: 'Performance test message' }
      );
      
      // Measure performance of adding memories one by one
      await measurePerformance(
        `Adding ${memories.length} individual memories`,
        async () => {
          for (const memory of memories) {
            await memoryService.addMemory({
              id: memory.id,
              content: memory.payload.text,
              type: memory.payload.type as MemoryType,
              metadata: memory.payload.metadata
            });
          }
          return memories.length;
        }
      );
      
      // If client supports batch operations, measure that too
      if (typeof client.addPoints === 'function') {
        await measurePerformance(
          `Adding ${memories.length} memories in batch`,
          async () => {
            await client.addPoints('message', memories);
            return memories.length;
          }
        );
      }
    }, PERFORMANCE_TEST_CONFIG.timeout);
    
    test('should measure performance of adding medium batch of memories', async () => {
      // Only run this test if explicitly enabled
      if (!process.env.RUN_LARGE_PERFORMANCE_TESTS) {
        console.log('Skipping medium batch test - enable with RUN_LARGE_PERFORMANCE_TESTS');
        return;
      }
      
      // Generate medium batch of test data
      const memories = generateMemoryPoints(
        PERFORMANCE_TEST_CONFIG.mediumBatchSize,
        MemoryType.MESSAGE,
        { baseContent: 'Medium batch performance test' }
      );
      
      // Measure batch performance
      if (typeof client.addPoints === 'function') {
        await measurePerformance(
          `Adding ${memories.length} memories in batch`,
          async () => {
            await client.addPoints('message', memories);
            return memories.length;
          }
        );
      }
    }, PERFORMANCE_TEST_CONFIG.timeout);
  });
  
  describe('Memory retrieval performance', () => {
    // Setup test data
    let testMemories: ReturnType<typeof generateMemoryPoints>;
    
    beforeAll(async () => {
      // Generate and add test memories
      testMemories = generateMemoryPoints(
        PERFORMANCE_TEST_CONFIG.smallBatchSize,
        MemoryType.MESSAGE,
        { baseContent: 'Retrieval performance test' }
      );
      
      if (typeof client.addPoints === 'function') {
        await client.addPoints('message', testMemories);
      } else {
        for (const memory of testMemories) {
          await memoryService.addMemory({
            id: memory.id,
            content: memory.payload.text,
            type: memory.payload.type as MemoryType,
            metadata: memory.payload.metadata
          });
        }
      }
    }, PERFORMANCE_TEST_CONFIG.timeout);
    
    test('should measure performance of retrieving individual memories', async () => {
      // Select a random memory to retrieve
      const randomIndex = Math.floor(Math.random() * testMemories.length);
      const memoryToRetrieve = testMemories[randomIndex];
      
      // Measure single memory retrieval
      await measurePerformance(
        `Retrieving a single memory by ID`,
        async () => {
          return await memoryService.getMemory({
            id: memoryToRetrieve.id,
            type: memoryToRetrieve.payload.type as MemoryType
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
    }, PERFORMANCE_TEST_CONFIG.timeout);
    
    test('should measure performance of searching memories', async () => {
      // Measure search performance
      await measurePerformance(
        `Searching memories by content`,
        async () => {
          return await searchService.search('performance test', {
            types: [MemoryType.MESSAGE],
            limit: 5
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
      
      // Measure search with filter
      await measurePerformance(
        `Searching memories with metadata filter`,
        async () => {
          const filter = searchService.buildFilter({
            types: [MemoryType.MESSAGE],
            metadata: {
              source: 'test'
            }
          });
          
          return await searchService.search('performance', {
            filter,
            limit: 5
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
    }, PERFORMANCE_TEST_CONFIG.timeout);
  });
  
  describe('Memory update performance', () => {
    // Setup test data
    let updateTestMemory: ReturnType<typeof generateMemoryPoints>[0];
    
    beforeAll(async () => {
      // Generate and add a test memory
      const memories = generateMemoryPoints(
        1,
        MemoryType.MESSAGE,
        { baseContent: 'Update performance test' }
      );
      
      updateTestMemory = memories[0];
      
      await memoryService.addMemory({
        id: updateTestMemory.id,
        content: updateTestMemory.payload.text,
        type: updateTestMemory.payload.type as MemoryType,
        metadata: updateTestMemory.payload.metadata
      });
    }, PERFORMANCE_TEST_CONFIG.timeout);
    
    test('should measure performance of updating memories', async () => {
      // Measure update performance
      await measurePerformance(
        `Updating memory content (with new embedding)`,
        async () => {
          return await memoryService.updateMemory({
            id: updateTestMemory.id,
            type: updateTestMemory.payload.type as MemoryType,
            content: `Updated content at ${Date.now()}`
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
      
      // Measure update without embedding change
      await measurePerformance(
        `Updating memory metadata (no embedding change)`,
        async () => {
          return await memoryService.updateMemory({
            id: updateTestMemory.id,
            type: updateTestMemory.payload.type as MemoryType,
            metadata: { 
              importance: Math.random() > 0.5 ? 'high' : 'medium',
              updateTimestamp: Date.now()
            }
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
    }, PERFORMANCE_TEST_CONFIG.timeout);
  });
  
  describe('Hybrid search performance', () => {
    test('should measure performance of hybrid search', async () => {
      // Measure hybrid search performance
      await measurePerformance(
        `Hybrid search (vector + text)`,
        async () => {
          return await searchService.hybridSearch('performance test', {
            types: [MemoryType.MESSAGE],
            limit: 5,
            textWeight: 0.3,
            vectorWeight: 0.7
          });
        },
        PERFORMANCE_TEST_CONFIG.iterations
      );
    }, PERFORMANCE_TEST_CONFIG.timeout);
  });
}); 