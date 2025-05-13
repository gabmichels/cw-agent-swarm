/**
 * Tests for DefaultMemoryTransformationSystem
 * 
 * This file tests the implementation of the memory transformation system.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { DefaultMemoryTransformationSystem } from '../DefaultMemoryTransformationSystem';
import { 
  MemoryTransformationType, 
  TransformationQuality,
  SummarizationOptions,
  CategorizationOptions,
  ExpansionOptions,
  ExtractionOptions,
  IntegrationOptions
} from '../../interfaces/MemoryTransformation.interface';

describe('DefaultMemoryTransformationSystem', () => {
  // Mock memory manager
  const mockMemoryManager = {
    searchMemories: vi.fn()
  };

  // Mock memory data
  const mockMemory = {
    id: 'memory-123',
    content: 'This is a test memory with sample content for transformation testing.',
    metadata: {},
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    accessCount: 1
  };

  let transformationSystem: DefaultMemoryTransformationSystem;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup default mock behavior
    mockMemoryManager.searchMemories.mockResolvedValue([mockMemory]);
    
    // Create system under test
    transformationSystem = new DefaultMemoryTransformationSystem(mockMemoryManager as any);
  });

  it('should initialize correctly', () => {
    expect(transformationSystem).toBeDefined();
  });

  it('should throw error when memory not found', async () => {
    // Setup mock to return empty result
    mockMemoryManager.searchMemories.mockResolvedValue([]);
    
    // Attempt to transform non-existent memory
    const transformPromise = transformationSystem.transformMemory('non-existent', {
      transformationType: MemoryTransformationType.SUMMARIZATION
    });
    
    // Assert error is thrown
    await expect(transformPromise).resolves.toMatchObject({
      success: false,
      errorMessage: expect.stringContaining('not found')
    });
  });

  it('should summarize memory', async () => {
    const result = await transformationSystem.summarizeMemory('memory-123');
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.SUMMARIZATION,
      originalMemoryId: 'memory-123'
    });
    expect(result.content).toContain('summary');
  });

  it('should categorize memory', async () => {
    const result = await transformationSystem.categorizeMemory('memory-123', {
      maxCategories: 3
    });
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.CATEGORIZATION,
      originalMemoryId: 'memory-123'
    });
    expect(Array.isArray(result.structuredResult)).toBe(true);
  });

  it('should expand memory', async () => {
    const result = await transformationSystem.expandMemory('memory-123', {
      focusAreas: ['key concepts']
    });
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.EXPANSION,
      originalMemoryId: 'memory-123'
    });
    expect(result.content.length).toBeGreaterThan(mockMemory.content.length);
  });

  it('should extract from memory', async () => {
    const result = await transformationSystem.extractFromMemory('memory-123', {
      extractionTargets: ['entities', 'concepts']
    });
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.EXTRACTION,
      originalMemoryId: 'memory-123'
    });
    expect(result.structuredResult).toBeDefined();
  });

  it('should throw error for extraction without targets', async () => {
    // Attempt to extract without specifying targets
    const extractPromise = transformationSystem.extractFromMemory('memory-123', {
      // Missing extractionTargets
    } as any);
    
    // Assert that an appropriate error is returned in the result
    await expect(extractPromise).rejects.toThrow('Extraction targets are required');
  });

  it('should integrate multiple memories', async () => {
    // Setup mocks for second memory
    const mockMemory2 = {
      ...mockMemory,
      id: 'memory-456',
      content: 'This is a second test memory for integration testing.'
    };
    
    // Update mock to return different memories based on search query
    mockMemoryManager.searchMemories.mockImplementation((query) => {
      if (query.includes('memory-123')) {
        return Promise.resolve([mockMemory]);
      } else if (query.includes('memory-456')) {
        return Promise.resolve([mockMemory2]);
      }
      return Promise.resolve([]);
    });
    
    const result = await transformationSystem.integrateMemories({
      transformationType: MemoryTransformationType.INTEGRATION,
      memoryIds: ['memory-123', 'memory-456']
    });
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.INTEGRATION,
      originalMemoryId: 'memory-123'
    });
    expect(result.content).toContain('Integration of 2 memories');
  });

  it('should handle custom transformation type', async () => {
    const result = await transformationSystem.transformMemory('memory-123', {
      transformationType: MemoryTransformationType.CUSTOM
    });
    
    expect(result).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.CUSTOM,
      originalMemoryId: 'memory-123'
    });
  });

  it('should batch transform memories', async () => {
    // Setup mocks for second memory
    const mockMemory2 = {
      ...mockMemory,
      id: 'memory-456',
      content: 'This is a second test memory for batch transformation.'
    };
    
    // Update mock to return different memories based on search query
    mockMemoryManager.searchMemories.mockImplementation((query) => {
      if (query.includes('memory-123')) {
        return Promise.resolve([mockMemory]);
      } else if (query.includes('memory-456')) {
        return Promise.resolve([mockMemory2]);
      }
      return Promise.resolve([]);
    });
    
    const results = await transformationSystem.batchTransformMemories(
      ['memory-123', 'memory-456'],
      {
        transformationType: MemoryTransformationType.SUMMARIZATION
      }
    );
    
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.SUMMARIZATION,
      originalMemoryId: 'memory-123'
    });
    expect(results[1]).toMatchObject({
      success: true,
      transformationType: MemoryTransformationType.SUMMARIZATION,
      originalMemoryId: 'memory-456'
    });
  });

  it('should get transformation history for a memory', async () => {
    // First, perform a transformation to record in history
    await transformationSystem.summarizeMemory('memory-123');
    
    // Then, get the history
    const history = await transformationSystem.getTransformationHistory('memory-123');
    
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      transformationType: MemoryTransformationType.SUMMARIZATION,
      originalMemoryId: 'memory-123'
    });
  });

  it('should handle errors during transformation', async () => {
    // Setup mock to throw error
    mockMemoryManager.searchMemories.mockRejectedValue(new Error('Test error'));
    
    // Attempt transformation
    const result = await transformationSystem.transformMemory('memory-123', {
      transformationType: MemoryTransformationType.SUMMARIZATION
    });
    
    expect(result).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining('Test error')
    });
  });
}); 