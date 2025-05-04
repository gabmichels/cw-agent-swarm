/**
 * Unit tests for MemoryService
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MemoryType } from '../../config';
import { BaseMemorySchema } from '../../models';

describe('MemoryService', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  const mockTimestamp = 1625097600000; // Fixed timestamp for testing

  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    // Initialize memory service with mocks and fixed timestamp
    // @ts-ignore - MockEmbeddingService needs to be compatible with EmbeddingService
    memoryService = new MemoryService(mockClient, mockEmbeddingService, {
      getTimestamp: () => mockTimestamp
    });
  });

  describe('addMemory', () => {
    test('should add a valid memory', async () => {
      // Setup test data
      const content = 'Test memory content';
      const type = MemoryType.MESSAGE;
      const memoryId = 'test-id-1';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      // Setup spies BEFORE operations
      const addPointSpy = vi.spyOn(mockClient, 'addPoint');
      
      // Mock embedding service to return predictable vector
      vi.spyOn(mockEmbeddingService, 'getEmbedding').mockResolvedValue({
        embedding: mockEmbedding,
        model: 'mock-model',
        usedFallback: false
      });
      
      // Add memory
      const result = await memoryService.addMemory({
        content,
        type,
        id: memoryId
      });
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.id).toBe(memoryId);
      
      // Verify point was added to client
      expect(addPointSpy).toHaveBeenCalledTimes(1);
      
      // Verify point data structure
      const addedPoint = addPointSpy.mock.calls[0][1];
      expect(addedPoint.id).toBe(memoryId);
      expect(addedPoint.vector).toEqual(mockEmbedding);
      expect(addedPoint.payload?.text).toBe(content);
      expect(addedPoint.payload?.type).toBe(type);
      expect(addedPoint.payload?.timestamp).toBe(mockTimestamp.toString());
    });
    
    test('should generate ID if not provided', async () => {
      // Setup test data
      const content = 'Test memory without ID';
      const type = MemoryType.MESSAGE;
      
      // Add memory without ID
      const result = await memoryService.addMemory({
        content,
        type
      });
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
    
    test('should handle validation errors', async () => {
      // Add memory with empty content which should fail validation
      const result = await memoryService.addMemory({
        content: '',
        type: MemoryType.MESSAGE
      });
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('MEMORY_VALIDATION_ERROR');
    });
  });
  
  describe('getMemory', () => {
    test('should retrieve a memory by ID', async () => {
      // Setup: First add a memory
      const memoryId = 'get-test-id';
      const content = 'Memory to retrieve';
      const type = MemoryType.MESSAGE;
      
      // Mock client to return a specific point
      const mockPoint = {
        id: memoryId,
        vector: [0.1, 0.2, 0.3],
        payload: {
          text: content,
          type,
          timestamp: mockTimestamp.toString(),
          id: memoryId,
          metadata: {}
        }
      };
      
      vi.spyOn(mockClient, 'getPoints').mockResolvedValue([mockPoint]);
      
      // Retrieve the memory
      const result = await memoryService.getMemory({
        id: memoryId,
        type
      });
      
      // Assertions
      expect(result).not.toBeNull();
      expect(result?.id).toBe(memoryId);
      expect(result?.payload.text).toBe(content);
      expect(result?.payload.type).toBe(type);
    });
    
    test('should return null for non-existent memory', async () => {
      // Mock client to return empty array (memory not found)
      vi.spyOn(mockClient, 'getPoints').mockResolvedValue([]);
      
      // Retrieve non-existent memory
      const result = await memoryService.getMemory({
        id: 'non-existent-id',
        type: MemoryType.MESSAGE
      });
      
      // Assertions
      expect(result).toBeNull();
    });
  });
  
  describe('updateMemory', () => {
    test('should update memory content and generate new embedding', async () => {
      // Setup
      const memoryId = 'update-test-id';
      const type = MemoryType.MESSAGE;
      const newContent = 'Updated memory content';
      const newEmbedding = [0.4, 0.5, 0.6];
      
      // Setup spy BEFORE operations
      const updateSpy = vi.spyOn(mockClient, 'updatePoint').mockResolvedValue(true);
      
      // Mock embedding service
      vi.spyOn(mockEmbeddingService, 'getEmbedding').mockResolvedValue({
        embedding: newEmbedding,
        model: 'mock-model',
        usedFallback: false
      });
      
      // Update memory
      const result = await memoryService.updateMemory({
        id: memoryId,
        type,
        content: newContent
      });
      
      // Assertions
      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      
      // Verify update contains new content and embedding
      const updateParams = updateSpy.mock.calls[0][2];
      expect(updateParams.vector).toEqual(newEmbedding);
      expect(updateParams.payload?.text).toBe(newContent);
    });
    
    test('should update memory without changing embedding when preserveEmbedding is true', async () => {
      // Setup
      const memoryId = 'preserve-embedding-id';
      const type = MemoryType.MESSAGE;
      const newContent = 'New content, same embedding';
      
      // Setup spy BEFORE operations
      const getEmbeddingSpy = vi.spyOn(mockEmbeddingService, 'getEmbedding');
      const updateSpy = vi.spyOn(mockClient, 'updatePoint').mockResolvedValue(true);
      
      // Update memory with preserveEmbedding
      const result = await memoryService.updateMemory({
        id: memoryId,
        type,
        content: newContent,
        preserveEmbedding: true
      });
      
      // Assertions
      expect(result).toBe(true);
      
      // Embedding service should not be called
      expect(getEmbeddingSpy).not.toHaveBeenCalled();
      
      // Update should only contain content, not vector
      const updateParams = updateSpy.mock.calls[0][2];
      expect(updateParams.vector).toBeUndefined();
      expect(updateParams.payload?.text).toBe(newContent);
    });
    
    test('should update metadata only', async () => {
      // Setup
      const memoryId = 'metadata-update-id';
      const type = MemoryType.MESSAGE;
      const metadata = { importance: 'high', category: 'test' };
      
      // Setup spy BEFORE operations
      const updateSpy = vi.spyOn(mockClient, 'updatePoint').mockResolvedValue(true);
      
      // Update only metadata
      const result = await memoryService.updateMemory({
        id: memoryId,
        type,
        metadata
      });
      
      // Assertions
      expect(result).toBe(true);
      
      // Update should only contain metadata changes
      const updateParams = updateSpy.mock.calls[0][2];
      expect(updateParams.vector).toBeUndefined();
      expect(updateParams.payload?.text).toBeUndefined();
      expect(updateParams.payload?.metadata).toEqual(metadata);
    });
  });
  
  describe('deleteMemory', () => {
    test('should delete a memory', async () => {
      // Setup
      const memoryId = 'delete-test-id';
      const type = MemoryType.MESSAGE;
      
      // Set up spy BEFORE operations
      const deleteSpy = vi.spyOn(mockClient, 'deletePoint').mockResolvedValue(true);
      
      // Delete memory
      const result = await memoryService.deleteMemory({
        id: memoryId,
        type
      });
      
      // Assertions
      expect(result).toBe(true);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy.mock.calls[0][1]).toBe(memoryId);
    });
    
    test('should support soft delete', async () => {
      // Setup
      const memoryId = 'soft-delete-id';
      const type = MemoryType.MESSAGE;
      
      // Set up spy BEFORE operations
      const deleteSpy = vi.spyOn(mockClient, 'deletePoint').mockResolvedValue(true);
      
      // Soft delete memory
      const result = await memoryService.deleteMemory({
        id: memoryId,
        type,
        hardDelete: false
      });
      
      // Assertions
      expect(result).toBe(true);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      
      // Verify soft delete option was passed
      const deleteOptions = deleteSpy.mock.calls[0][2];
      expect(deleteOptions).toBeDefined();
      expect(deleteOptions?.hardDelete).toBe(false);
    });
  });
  
  describe('searchMemories', () => {
    test('should search using query text', async () => {
      // Setup
      const query = 'search query';
      const type = MemoryType.MESSAGE;
      const searchEmbedding = [0.7, 0.8, 0.9];
      
      // Set up spies BEFORE operations
      const searchSpy = vi.spyOn(mockClient, 'searchPoints').mockResolvedValue([]);
      
      // Mock embedding service
      vi.spyOn(mockEmbeddingService, 'getEmbedding').mockResolvedValue({
        embedding: searchEmbedding,
        model: 'mock-model',
        usedFallback: false
      });
      
      // Mock search results
      const mockResults = [
        {
          id: 'result-1',
          score: 0.95,
          payload: {
            text: 'First search result',
            type,
            timestamp: '1625097600000',
            id: 'result-1',
            metadata: {}
          }
        },
        {
          id: 'result-2',
          score: 0.85,
          payload: {
            text: 'Second search result',
            type,
            timestamp: '1625097500000',
            id: 'result-2',
            metadata: {}
          }
        }
      ];
      
      searchSpy.mockResolvedValue(mockResults);
      
      // Perform search
      const results = await memoryService.searchMemories({
        query,
        type,
        limit: 10
      });
      
      // Assertions
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('result-1');
      expect(results[0].payload.text).toBe('First search result');
      expect(results[1].id).toBe('result-2');
      
      // Verify search params
      expect(searchSpy).toHaveBeenCalledTimes(1);
      
      const searchParams = searchSpy.mock.calls[0][1];
      expect(searchParams.vector).toEqual(searchEmbedding);
      expect(searchParams.limit).toBe(10);
    });
    
    test('should search using provided vector', async () => {
      // Setup
      const searchVector = [0.1, 0.2, 0.3];
      const type = MemoryType.MESSAGE;
      
      // Set up spies BEFORE operations
      const searchSpy = vi.spyOn(mockClient, 'searchPoints');
      const embedSpy = vi.spyOn(mockEmbeddingService, 'getEmbedding');
      
      // Mock search results
      const mockResults = [
        {
          id: 'vector-result-1',
          score: 0.92,
          payload: {
            text: 'Vector search result',
            type,
            timestamp: '1625097600000',
            id: 'vector-result-1',
            metadata: {}
          }
        }
      ];
      
      searchSpy.mockResolvedValue(mockResults);
      
      // Perform search with vector instead of query
      const results = await memoryService.searchMemories({
        vector: searchVector,
        type,
        minScore: 0.8
      });
      
      // Assertions
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('vector-result-1');
      
      // Verify embedding service wasn't called (vector provided)
      expect(embedSpy).not.toHaveBeenCalled();
      
      // Verify search params
      expect(searchSpy).toHaveBeenCalledTimes(1);
      const searchParams = searchSpy.mock.calls[0][1];
      expect(searchParams.vector).toEqual(searchVector);
      expect(searchParams.scoreThreshold).toBe(0.8);
    });
    
    test('should apply filters and return formatted results', async () => {
      // Setup
      const type = MemoryType.MESSAGE;
      const filter = { 'metadata.category': 'important' };
      const searchVector = [0.1, 0.2, 0.3];
      
      // Set up spies BEFORE operations
      const searchSpy = vi.spyOn(mockClient, 'searchPoints');
      
      // Mock search results
      const mockResults = [
        {
          id: 'filtered-result',
          score: 0.88,
          payload: {
            text: 'Filtered search result',
            type,
            timestamp: '1625097600000',
            id: 'filtered-result',
            metadata: { category: 'important' }
          }
        }
      ];
      
      searchSpy.mockResolvedValue(mockResults);
      
      // Perform search with filter
      const results = await memoryService.searchMemories({
        vector: searchVector,
        type,
        filter
      });
      
      // Assertions
      expect(results).toHaveLength(1);
      
      // Verify search params included filter
      expect(searchSpy).toHaveBeenCalledTimes(1);
      const searchParams = searchSpy.mock.calls[0][1];
      expect(searchParams.filter).toEqual(filter);
    });
  });
}); 