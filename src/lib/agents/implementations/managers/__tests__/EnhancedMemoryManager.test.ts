/**
 * Tests for Enhanced Memory Manager
 * 
 * These tests verify that the enhanced memory manager properly processes memories
 * with intelligent tagging and importance calculation.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Test-driven development
 * - >95% code coverage
 * - Both happy paths and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedMemoryManager } from '../EnhancedMemoryManager';
import { ImportanceLevel } from '../../../../../constants/memory';

describe('EnhancedMemoryManager', () => {
  let memoryManager: EnhancedMemoryManager;

  beforeEach(() => {
    memoryManager = new EnhancedMemoryManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Memory Operations', () => {
    it('should store a memory with enhanced processing by default', async () => {
      const content = 'This is a test memory';
      const metadata = { type: 'test', source: 'user' };

      const memory = await memoryManager.addMemory(content, metadata);

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.content).toBe(content);
      expect(memory.metadata.processingMethod).toBe('enhanced_ai');
      expect(memory.metadata.finalImportance).toBe(ImportanceLevel.MEDIUM);
      
      // Check ULID format (26 characters, alphanumeric)
      expect(memory.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('should allow explicit processing method override', async () => {
      const content = 'Test memory with explicit processing method';
      const metadata = { 
        type: 'test', 
        source: 'user',
        processingMethod: 'basic_fallback'
      };

      const memory = await memoryManager.addMemory(content, metadata);

      expect(memory.metadata.processingMethod).toBe('basic_fallback');
    });

    it('should retrieve stored memory by ID', async () => {
      const content = 'Test memory for retrieval';
      const storedMemory = await memoryManager.addMemory(content);

      const retrievedMemory = await memoryManager.getMemory(storedMemory.id);

      expect(retrievedMemory).toBeDefined();
      expect(retrievedMemory!.content).toBe(content);
      expect(retrievedMemory!.id).toBe(storedMemory.id);
    });

    it('should return null for non-existent memory ID', async () => {
      const retrievedMemory = await memoryManager.getMemory('non-existent-id');
      expect(retrievedMemory).toBeNull();
    });

    it('should retrieve all memories', async () => {
      await memoryManager.addMemory('Memory 1');
      await memoryManager.addMemory('Memory 2');
      await memoryManager.addMemory('Memory 3');

      const allMemories = await memoryManager.getAllMemories();

      expect(allMemories).toHaveLength(3);
      expect(allMemories.map(m => m.content)).toContain('Memory 1');
      expect(allMemories.map(m => m.content)).toContain('Memory 2');
      expect(allMemories.map(m => m.content)).toContain('Memory 3');
    });
  });

  describe('Importance-Based Operations', () => {
    it('should filter memories by importance level', async () => {
      // Store memories with different importance levels
      await memoryManager.addMemory('Critical memory', { 
        finalImportance: ImportanceLevel.CRITICAL 
      });
      await memoryManager.addMemory('High memory', { 
        finalImportance: ImportanceLevel.HIGH 
      });
      await memoryManager.addMemory('Medium memory', { 
        finalImportance: ImportanceLevel.MEDIUM 
      });

      const criticalMemories = await memoryManager.getMemoriesByImportance(ImportanceLevel.CRITICAL);
      const highMemories = await memoryManager.getMemoriesByImportance(ImportanceLevel.HIGH);
      const mediumMemories = await memoryManager.getMemoriesByImportance(ImportanceLevel.MEDIUM);

      expect(criticalMemories).toHaveLength(1);
      expect(criticalMemories[0].content).toBe('Critical memory');
      
      expect(highMemories).toHaveLength(1);
      expect(highMemories[0].content).toBe('High memory');
      
      expect(mediumMemories).toHaveLength(1);
      expect(mediumMemories[0].content).toBe('Medium memory');
    });

    it('should sort memories by importance score', async () => {
      // Store memories with different importance scores
      await memoryManager.addMemory('Low importance', { 
        importanceScore: 0.2,
        finalImportance: ImportanceLevel.LOW
      });
      await memoryManager.addMemory('High importance', { 
        importanceScore: 0.9,
        finalImportance: ImportanceLevel.CRITICAL
      });
      await memoryManager.addMemory('Medium importance', { 
        importanceScore: 0.5,
        finalImportance: ImportanceLevel.MEDIUM
      });

      const sortedMemories = await memoryManager.getMemoriesByImportanceScore();

      expect(sortedMemories).toHaveLength(3);
      expect(sortedMemories[0].content).toBe('High importance');
      expect(sortedMemories[1].content).toBe('Medium importance');
      expect(sortedMemories[2].content).toBe('Low importance');
    });

    it('should limit results when getting memories by importance score', async () => {
      // Store more memories than the limit
      for (let i = 0; i < 5; i++) {
        await memoryManager.addMemory(`Memory ${i}`, { 
          importanceScore: 0.1 * i 
        });
      }

      const limitedMemories = await memoryManager.getMemoriesByImportanceScore(3);

      expect(limitedMemories).toHaveLength(3);
    });

    it('should handle memories without importance scores', async () => {
      await memoryManager.addMemory('Memory without score');
      await memoryManager.addMemory('Memory with score', { importanceScore: 0.8 });

      const sortedMemories = await memoryManager.getMemoriesByImportanceScore();

      // Should only return memories with scores
      expect(sortedMemories).toHaveLength(1);
      expect(sortedMemories[0].content).toBe('Memory with score');
    });
  });

  describe('Tag-Based Operations', () => {
    it('should search memories by tags', async () => {
      await memoryManager.addMemory('Work related task', { 
        tags: ['work', 'task', 'urgent'] 
      });
      await memoryManager.addMemory('Personal note', { 
        tags: ['personal', 'note'] 
      });
      await memoryManager.addMemory('Work meeting', { 
        tags: ['work', 'meeting'] 
      });

      const workMemories = await memoryManager.searchByTags(['work']);
      const personalMemories = await memoryManager.searchByTags(['personal']);
      const urgentMemories = await memoryManager.searchByTags(['urgent']);

      expect(workMemories).toHaveLength(2);
      expect(workMemories.map(m => m.content)).toContain('Work related task');
      expect(workMemories.map(m => m.content)).toContain('Work meeting');

      expect(personalMemories).toHaveLength(1);
      expect(personalMemories[0].content).toBe('Personal note');

      expect(urgentMemories).toHaveLength(1);
      expect(urgentMemories[0].content).toBe('Work related task');
    });

    it('should handle case-insensitive tag search', async () => {
      await memoryManager.addMemory('Test memory', { 
        tags: ['Work', 'URGENT', 'Task'] 
      });

      const lowerCaseSearch = await memoryManager.searchByTags(['work']);
      const upperCaseSearch = await memoryManager.searchByTags(['WORK']);
      const mixedCaseSearch = await memoryManager.searchByTags(['Work']);

      expect(lowerCaseSearch).toHaveLength(1);
      expect(upperCaseSearch).toHaveLength(1);
      expect(mixedCaseSearch).toHaveLength(1);
    });

    it('should return empty array for non-matching tags', async () => {
      await memoryManager.addMemory('Test memory', { 
        tags: ['work', 'task'] 
      });

      const noMatches = await memoryManager.searchByTags(['nonexistent']);

      expect(noMatches).toHaveLength(0);
    });

    it('should handle memories without tags', async () => {
      await memoryManager.addMemory('Memory without tags');
      await memoryManager.addMemory('Memory with tags', { tags: ['test'] });

      const searchResults = await memoryManager.searchByTags(['test']);

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].content).toBe('Memory with tags');
    });
  });

  describe('Processing Statistics', () => {
    it('should track processing statistics correctly', async () => {
      // Add memories with different processing methods
      await memoryManager.addMemory('Enhanced memory', { 
        processingMethod: 'enhanced_ai',
        finalImportance: ImportanceLevel.HIGH
      });
      await memoryManager.addMemory('Basic memory', { 
        processingMethod: 'basic_fallback',
        finalImportance: ImportanceLevel.MEDIUM
      });
      await memoryManager.addMemory('Another enhanced', { 
        processingMethod: 'enhanced_ai',
        finalImportance: ImportanceLevel.CRITICAL
      });

      const stats = memoryManager.getProcessingStats();

      expect(stats.totalMemories).toBe(3);
      expect(stats.enhancedProcessed).toBe(2);
      expect(stats.basicFallback).toBe(1);
      expect(stats.importanceLevels[ImportanceLevel.HIGH]).toBe(1);
      expect(stats.importanceLevels[ImportanceLevel.MEDIUM]).toBe(1);
      expect(stats.importanceLevels[ImportanceLevel.CRITICAL]).toBe(1);
      expect(stats.importanceLevels[ImportanceLevel.LOW]).toBe(0);
    });

    it('should handle empty memory collection', async () => {
      const stats = memoryManager.getProcessingStats();

      expect(stats.totalMemories).toBe(0);
      expect(stats.enhancedProcessed).toBe(0);
      expect(stats.basicFallback).toBe(0);
      expect(stats.importanceLevels[ImportanceLevel.CRITICAL]).toBe(0);
      expect(stats.importanceLevels[ImportanceLevel.HIGH]).toBe(0);
      expect(stats.importanceLevels[ImportanceLevel.MEDIUM]).toBe(0);
      expect(stats.importanceLevels[ImportanceLevel.LOW]).toBe(0);
    });

    it('should handle unknown importance levels gracefully', async () => {
      await memoryManager.addMemory('Memory with unknown importance', { 
        finalImportance: 'unknown' as any
      });

      const stats = memoryManager.getProcessingStats();

      expect(stats.totalMemories).toBe(1);
      // Should not count the unknown importance level
      expect(Object.values(stats.importanceLevels).reduce((a, b) => a + b, 0)).toBe(0);
    });
  });

  describe('Memory Metadata Enhancement', () => {
    it('should preserve original metadata while adding enhancements', async () => {
      const originalMetadata = {
        userId: 'test-user',
        sessionId: 'test-session',
        type: 'user_input'
      };

      const memory = await memoryManager.addMemory('Test content', originalMetadata);

      expect(memory.metadata.userId).toBe('test-user');
      expect(memory.metadata.sessionId).toBe('test-session');
      expect(memory.metadata.type).toBe('user_input');
      expect(memory.metadata.processingMethod).toBeDefined();
      expect(memory.metadata.processingTimestamp).toBeDefined();
      expect(memory.metadata.finalImportance).toBeDefined();
    });

    it('should add timestamps and processing information', async () => {
      const beforeTime = new Date();
      const memory = await memoryManager.addMemory('Test content');
      const afterTime = new Date();

      expect(memory.metadata.createdAt).toBeDefined();
      expect(memory.metadata.processingTimestamp).toBeDefined();
      
      const createdAt = new Date(memory.metadata.createdAt as string);
      const processingTimestamp = new Date(memory.metadata.processingTimestamp as string);
      
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(processingTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(processingTimestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Memory Content Types', () => {
    it('should handle different types of content appropriately', async () => {
      const shortContent = 'Hi';
      const longContent = 'This is a very long piece of content that contains a lot of information and should potentially be rated as more important due to its length and comprehensive nature.';
      const structuredContent = JSON.stringify({
        type: 'goal',
        description: 'Increase user engagement by 30%',
        deadline: '2024-12-31'
      });

      const shortMemory = await memoryManager.addMemory(shortContent);
      const longMemory = await memoryManager.addMemory(longContent);
      const structuredMemory = await memoryManager.addMemory(structuredContent, { 
        type: 'goal' 
      });

      expect(shortMemory.content).toBe(shortContent);
      expect(longMemory.content).toBe(longContent);
      expect(structuredMemory.content).toBe(structuredContent);
      
      // All should have been processed
      expect(shortMemory.metadata.processingMethod).toBeDefined();
      expect(longMemory.metadata.processingMethod).toBeDefined();
      expect(structuredMemory.metadata.processingMethod).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should clear all memories', async () => {
      await memoryManager.addMemory('Memory 1');
      await memoryManager.addMemory('Memory 2');
      
      expect(await memoryManager.getAllMemories()).toHaveLength(2);
      
      memoryManager.clear();
      
      expect(await memoryManager.getAllMemories()).toHaveLength(0);
    });
  });
});

describe('EnhancedMemoryManager Integration Scenarios', () => {
  let memoryManager: EnhancedMemoryManager;

  beforeEach(() => {
    memoryManager = new EnhancedMemoryManager();
  });

  it('should handle a realistic conversation flow', async () => {
    // Simulate a conversation with different importance levels
    const greeting = await memoryManager.addMemory(
      'Hello, I need help with my marketing strategy',
      { type: 'user_input', source: 'user', finalImportance: ImportanceLevel.MEDIUM }
    );

    const goal = await memoryManager.addMemory(
      'My goal is to increase customer acquisition by 25% in Q1',
      { type: 'goal', source: 'user', finalImportance: ImportanceLevel.HIGH }
    );

    const response = await memoryManager.addMemory(
      'I can help you develop a comprehensive marketing strategy focusing on digital channels',
      { type: 'agent_response', source: 'agent', finalImportance: ImportanceLevel.MEDIUM }
    );

    const allMemories = await memoryManager.getAllMemories();
    expect(allMemories).toHaveLength(3);

    // Check that all memories were processed
    allMemories.forEach(memory => {
      expect(memory.metadata.processingMethod).toBeDefined();
      expect(memory.metadata.finalImportance).toBeDefined();
    });

    // Check importance distribution
    const highImportanceMemories = await memoryManager.getMemoriesByImportance(ImportanceLevel.HIGH);
    expect(highImportanceMemories).toHaveLength(1);
    expect(highImportanceMemories[0].content).toContain('goal');
  });

  it('should maintain memory relationships and context', async () => {
    const contextId = 'conversation-123';

    await memoryManager.addMemory(
      'I run a SaaS startup',
      { type: 'context', contextId }
    );

    await memoryManager.addMemory(
      'We need to improve our conversion rate',
      { type: 'problem', contextId }
    );

    await memoryManager.addMemory(
      'Current conversion rate is 2%',
      { type: 'metric', contextId }
    );

    const allMemories = await memoryManager.getAllMemories();
    const contextMemories = allMemories.filter(
      m => m.metadata.contextId === contextId
    );

    expect(contextMemories).toHaveLength(3);
  });

  it('should handle large memory collections efficiently', async () => {
    const startTime = Date.now();
    
    // Add 100 memories
    for (let i = 0; i < 100; i++) {
      await memoryManager.addMemory(`Memory ${i}`, {
        type: 'test',
        importance: i % 4 === 0 ? ImportanceLevel.HIGH : ImportanceLevel.MEDIUM,
        tags: [`tag${i % 10}`, 'test']
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (less than 1 second)
    expect(duration).toBeLessThan(1000);

    const allMemories = await memoryManager.getAllMemories();
    expect(allMemories).toHaveLength(100);

    const stats = memoryManager.getProcessingStats();
    expect(stats.totalMemories).toBe(100);
  });
}); 