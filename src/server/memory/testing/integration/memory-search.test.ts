import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MemoryType, ImportanceLevel } from '@/server/memory/config/types';
import { setupTestSuite, generateTestMemory } from './utils/test-setup';

describe('Basic Memory Search', () => {
  const { memoryService, mockMemoryClient } = setupTestSuite();

  // Simple test data
  const testMemories = [
    generateTestMemory('search-1', 'The quick brown fox jumps over the lazy dog', MemoryType.DOCUMENT, ImportanceLevel.HIGH),
    generateTestMemory('search-2', 'A lazy dog sleeps in the sun', MemoryType.THOUGHT, ImportanceLevel.MEDIUM),
    generateTestMemory('search-3', 'The fox is quick and brown', MemoryType.TASK, ImportanceLevel.LOW)
  ];

  beforeEach(async () => {
    await mockMemoryClient.cleanup();
    // Add test memories
    for (const memory of testMemories) {
      await memoryService.addMemory({
        type: memory.type,
        content: memory.text,
        metadata: memory.metadata,
        id: memory.id
      });
    }
  });

  afterEach(async () => {
    await mockMemoryClient.cleanup();
  });

  test('should find memories by text', async () => {
    // Search in all memory types
    const results = await Promise.all([
      memoryService.searchMemories({
        type: MemoryType.DOCUMENT,
        query: 'fox'
      }),
      memoryService.searchMemories({
        type: MemoryType.THOUGHT,
        query: 'fox'
      }),
      memoryService.searchMemories({
        type: MemoryType.TASK,
        query: 'fox'
      })
    ]);
    
    // Combine results from all types
    const allResults = results.flat();
    expect(allResults).toHaveLength(3);
    expect(allResults.map(r => r.id).sort()).toEqual(['search-1', 'search-2', 'search-3'].sort());
  });
}); 