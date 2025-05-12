import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MemoryType, ImportanceLevel } from '../../config/types';
import { setupTestSuite, generateTestMemory } from './utils/test-setup';

describe('Basic Memory Operations', () => {
  const { memoryService, mockMemoryClient } = setupTestSuite();

  // Simple test data
  const testMemories = [
    generateTestMemory('test-1', 'Test memory 1', MemoryType.DOCUMENT, ImportanceLevel.HIGH),
    generateTestMemory('test-2', 'Test memory 2', MemoryType.THOUGHT, ImportanceLevel.MEDIUM),
    generateTestMemory('test-3', 'Test memory 3', MemoryType.TASK, ImportanceLevel.LOW)
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

  test('should add and retrieve memory', async () => {
    const memory = testMemories[0];
    const result = await memoryService.getMemory({ id: memory.id, type: memory.type });
    
    expect(result).not.toBeNull();
    expect(result?.id).toBe(memory.id);
    expect(result?.payload.text).toBe(memory.text);
    expect(result?.payload.type).toBe(memory.type);
    expect(result?.payload.metadata.importance).toBe(memory.metadata.importance);
  });

  test('should update memory', async () => {
    const memory = testMemories[0];
    const updatedText = 'Updated test memory';
    
    await memoryService.updateMemory({
      type: memory.type,
      id: memory.id,
      content: updatedText
    });
    
    const updated = await memoryService.getMemory({ id: memory.id, type: memory.type });
    expect(updated).not.toBeNull();
    expect(updated?.payload.text).toBe(updatedText);
  });

  test('should delete memory', async () => {
    const memory = testMemories[0];
    
    await memoryService.deleteMemory({ 
      id: memory.id, 
      type: memory.type,
      hardDelete: true 
    });
    
    const deleted = await memoryService.getMemory({ id: memory.id, type: memory.type });
    expect(deleted).toBeNull();
  });
}); 