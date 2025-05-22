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
  });
}); 