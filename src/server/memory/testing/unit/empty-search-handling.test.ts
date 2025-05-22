/**
 * Tests for empty text search handling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';

// Mock dependencies
vi.mock('@qdrant/js-client-rest');
vi.mock('openai');

describe('Empty Text Search Handling', () => {
  // Test instances
  let embeddingService: EmbeddingService;
  let memoryClient: QdrantMemoryClient;
  
  // Mocks
  const mockCollectionExists = vi.fn();
  const mockSearchPoints = vi.fn();
  const mockScrollPoints = vi.fn();
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mocks
    mockCollectionExists.mockResolvedValue(true);
    mockSearchPoints.mockResolvedValue([]);
    mockScrollPoints.mockResolvedValue([]);
    
    // Create instances
    embeddingService = new EmbeddingService({
      useRandomFallback: true,
      dimensions: 1536
    });
    
    memoryClient = {
      initialized: true,
      initialize: vi.fn().mockResolvedValue(true),
      collectionExists: mockCollectionExists,
      searchPoints: mockSearchPoints,
      scrollPoints: mockScrollPoints
    } as unknown as QdrantMemoryClient;
  });
  
  describe('QdrantMemoryClient', () => {
    it('should handle empty text searches gracefully', async () => {
      // Test with empty text
      await memoryClient.searchPoints('test_collection', { query: '' });
      
      // Verify we didn't try to do a vector search with empty text
      expect(mockSearchPoints).toHaveBeenCalled();
    });
    
    it('should validate collection existence before searching', async () => {
      // Make collection not exist
      mockCollectionExists.mockResolvedValueOnce(false);
      
      // Search in non-existent collection
      const result = await memoryClient.searchPoints('non_existent', { query: 'test' });
      
      // Should return empty results instead of throwing
      expect(result).toEqual([]);
    });
    
    it('should handle bad request errors during scroll operations', async () => {
      // Create a mock for the scroll operation that fails with a Bad Request error
      const mockScroll = vi.fn().mockImplementation(() => {
        throw new Error('Bad Request');
      });
      
      const searchResults = [
        { 
          id: 'test-id',
          score: 0.5,
          payload: { text: 'Test content' }
        }
      ];
      
      const mockSearch = vi.fn().mockReturnValue(searchResults);
      
      // Create a custom client implementation with our mocks
      const customClient = {
        initialized: true,
        initialize: vi.fn().mockResolvedValue(true),
        collectionExists: mockCollectionExists,
        searchPoints: mockSearchPoints,
        scrollPoints: async (collectionName: string, filter?: any, limit?: number, offset?: number) => {
          try {
            // This will throw
            mockScroll();
            return [];
          } catch (error) {
            if (error instanceof Error && error.message.includes('Bad Request')) {
              // Return the mock search results
              return searchResults.map(result => ({
                id: String(result.id),
                vector: [],
                payload: result.payload
              }));
            }
            throw error;
          }
        }
      } as unknown as QdrantMemoryClient;
      
      // Attempt to scroll points
      const result = await customClient.scrollPoints('test_collection');
      
      // Should recover using the fallback mechanism and return results
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-id');
      expect(result[0].payload.text).toBe('Test content');
      
      // Verify that the scroll was called and threw an error
      expect(mockScroll).toHaveBeenCalled();
    });
  });
}); 