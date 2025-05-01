import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import * as memory from '../src/server/qdrant';
import { ChloeMemory } from '../src/agents/chloe/memory';
import { ImportanceLevel, MemorySource } from '../src/constants/memory';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../src/server/qdrant');

describe('Markdown Memory Retrieval', () => {
  let chloeMemory: ChloeMemory;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Mock memory.initMemory to do nothing
    vi.mocked(memory.initMemory).mockResolvedValue();
    
    // Mock memory.searchMemory
    vi.mocked(memory.searchMemory).mockImplementation(async (type, query, options) => {
      // For testing memory types
      if (query.includes('strategy')) {
        return [
          {
            id: 'mem1',
            text: 'This is a strategy memory',
            timestamp: new Date().toISOString(),
            type: 'document',
            metadata: {
              type: 'STRATEGY',
              title: 'Marketing Strategy',
              filePath: 'company/strategy/marketing.md',
              tags: ['marketing', 'strategy']
            }
          }
        ];
      } else if (query.includes('process')) {
        return [
          {
            id: 'mem2',
            text: 'This is a process memory',
            timestamp: new Date().toISOString(),
            type: 'document',
            metadata: {
              type: 'PROCESS',
              title: 'Content Creation Process',
              filePath: 'domains/marketing/content.md',
              tags: ['content', 'process']
            }
          }
        ];
      } else {
        return [];
      }
    });
    
    // Initialize memory
    chloeMemory = new ChloeMemory();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return empty array for uninitialized memory', async () => {
    const result = await chloeMemory.getRelevantMemoriesByType('test query', ['STRATEGY'], 5);
    expect(result.entries).toEqual([]);
    expect(result.sourceFiles).toEqual([]);
    expect(result.typesFound).toEqual([]);
  });
  
  it('should initialize memory when calling getRelevantMemoriesByType', async () => {
    await chloeMemory.getRelevantMemoriesByType('test query', ['STRATEGY'], 5);
    expect(memory.initMemory).toHaveBeenCalledTimes(1);
  });
  
  it('should retrieve memories by type', async () => {
    // Mark memory as initialized to avoid initialization call
    vi.spyOn(chloeMemory as any, 'initialized', 'get').mockReturnValue(true);
    
    const result = await chloeMemory.getRelevantMemoriesByType('find strategy documents', ['STRATEGY'], 5);
    
    expect(result.entries.length).toBe(1);
    expect(result.sourceFiles).toContain('company/strategy/marketing.md');
    expect(result.typesFound).toContain('STRATEGY');
    expect(memory.searchMemory).toHaveBeenCalledWith(
      'document',
      'find strategy documents',
      expect.objectContaining({
        filter: expect.objectContaining({
          type: 'STRATEGY'
        })
      })
    );
  });
  
  it('should retrieve memories for multiple types', async () => {
    // Mark memory as initialized to avoid initialization call
    vi.spyOn(chloeMemory as any, 'initialized', 'get').mockReturnValue(true);
    
    // Mock searchMemory to return different results based on filter
    vi.mocked(memory.searchMemory).mockImplementation(async (type, query, options) => {
      if (options?.filter?.type === 'STRATEGY') {
        return [
          {
            id: 'mem1',
            text: 'This is a strategy memory',
            timestamp: new Date().toISOString(),
            type: 'document',
            metadata: {
              type: 'STRATEGY',
              title: 'Marketing Strategy',
              filePath: 'company/strategy/marketing.md',
              tags: ['marketing', 'strategy']
            }
          }
        ];
      } else if (options?.filter?.type === 'PROCESS') {
        return [
          {
            id: 'mem2',
            text: 'This is a process memory',
            timestamp: new Date().toISOString(),
            type: 'document',
            metadata: {
              type: 'PROCESS',
              title: 'Content Creation Process',
              filePath: 'domains/marketing/content.md',
              tags: ['content', 'process']
            }
          }
        ];
      } else {
        return [];
      }
    });
    
    const result = await chloeMemory.getRelevantMemoriesByType(
      'planning with process and strategy', 
      ['STRATEGY', 'PROCESS', 'KNOWLEDGE'],
      5
    );
    
    expect(result.entries.length).toBe(2);
    expect(result.sourceFiles).toContain('company/strategy/marketing.md');
    expect(result.sourceFiles).toContain('domains/marketing/content.md');
    expect(result.typesFound).toContain('STRATEGY');
    expect(result.typesFound).toContain('PROCESS');
    expect(result.typesFound).not.toContain('KNOWLEDGE');
    expect(memory.searchMemory).toHaveBeenCalledTimes(3); // Once for each type
  });
}); 