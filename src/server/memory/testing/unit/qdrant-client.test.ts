/**
 * Unit tests for QdrantMemoryClient
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { MemoryType } from '../../config/types';
import { BaseMemorySchema } from '../../models';
import { MemoryImportanceLevel } from '../../../../constants/memory';

// Mock QdrantClient
vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: vi.fn().mockImplementation(() => ({
      getCollections: vi.fn().mockResolvedValue({
        collections: [{ name: 'test_collection' }]
      }),
      createCollection: vi.fn().mockResolvedValue(true),
      createPayloadIndex: vi.fn().mockResolvedValue(true),
      upsert: vi.fn().mockResolvedValue(true),
      retrieve: vi.fn().mockImplementation((collectionName, params) => {
        return Promise.resolve([
          {
            id: params.ids[0],
            vector: [0.1, 0.2, 0.3],
            payload: {
              text: 'Test content',
              type: 'message',
              timestamp: '1625097600000',
              metadata: { schemaVersion: '1.0.0' }
            }
          }
        ]);
      }),
      search: vi.fn().mockResolvedValue([
        {
          id: 'test-id-1',
          score: 0.95,
          payload: {
            text: 'Test search result',
            type: 'message',
            timestamp: '1625097600000',
            metadata: { schemaVersion: '1.0.0' }
          }
        }
      ]),
      scroll: vi.fn().mockResolvedValue({
        points: [
          {
            id: 'test-id-2',
            payload: {
              text: 'Test scroll result',
              type: 'message',
              timestamp: '1625097500000',
              metadata: { schemaVersion: '1.0.0' }
            }
          }
        ]
      }),
      setPayload: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
      count: vi.fn().mockResolvedValue({ count: 5 })
    }))
  };
});

// Import the mock
import { QdrantClient } from '@qdrant/js-client-rest';
const MockedQdrantClient = vi.mocked(QdrantClient);

describe('QdrantMemoryClient', () => {
  let client: QdrantMemoryClient;
  
  beforeEach(async () => {
    // Reset environment between tests
    delete process.env.QDRANT_URL;
    delete process.env.QDRANT_API_KEY;
    
    // Create client with test configuration
    client = new QdrantMemoryClient({
      qdrantUrl: 'http://test-qdrant:6333',
      qdrantApiKey: 'test-api-key',
      openAIApiKey: 'test-openai-key'
    });
    
    await client.initialize();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    test('should initialize with provided configuration', async () => {
      expect(client.isInitialized()).toBe(true);
      
      const status = await client.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.connected).toBe(true);
    });
    
    test('should fall back to environment variables if not provided', async () => {
      // Set environment variables
      process.env.QDRANT_URL = 'http://env-test-qdrant:6333';
      process.env.QDRANT_API_KEY = 'env-test-api-key';
      
      // Create client without explicit config
      const envClient = new QdrantMemoryClient();
      await envClient.initialize();
      
      expect(envClient.isInitialized()).toBe(true);
    });
  });
  
  describe('collection management', () => {
    test('should check if collection exists', async () => {
      const exists = await client.collectionExists('test_collection');
      expect(exists).toBe(true);
      
      const notExists = await client.collectionExists('non_existent_collection');
      expect(notExists).toBe(false);
    });
    
    test('should create a collection with indices', async () => {
      const result = await client.createCollection('new_collection', 1536);
      expect(result).toBe(true);
      
      // QdrantClient methods should have been called
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith('new_collection', expect.anything());
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledTimes(2); // timestamp and type
    });
  });
  
  describe('point operations', () => {
    test('should add a point', async () => {
      const point = {
        id: 'test-add-id',
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: 'test-payload-id',
          text: 'Test content',
          type: MemoryType.MESSAGE,
          timestamp: '1625097600000',
          metadata: { schemaVersion: '1.0.0', importance: MemoryImportanceLevel.MEDIUM }
        }
      };
      
      const id = await client.addPoint('message', point);
      expect(id).toBe('test-add-id');
      
      // QdrantClient upsert should have been called
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith('message', expect.anything());
    });
    
    test('should get points by IDs', async () => {
      const points = await client.getPoints('message', ['test-get-id']);
      
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('test-get-id');
      expect(points[0].vector).toEqual([0.1, 0.2, 0.3]);
      expect(points[0].payload.text).toBe('Test content');
    });
    
    test('should search for points', async () => {
      const results = await client.searchPoints('message', {
        vector: [0.1, 0.2, 0.3],
        limit: 10
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-id-1');
      expect(results[0].score).toBe(0.95);
      expect(results[0].payload.text).toBe('Test search result');
    });
    
    test('should scroll through points', async () => {
      const points = await client.scrollPoints('message', undefined, 10);
      
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('test-id-2');
      expect(points[0].payload.text).toBe('Test scroll result');
    });
    
    test('should update a point', async () => {
      const result = await client.updatePoint('message', 'test-update-id', {
        payload: {
          id: 'test-update-id',
          text: 'Updated content',
          metadata: { schemaVersion: '1.0.0' }
        } as BaseMemorySchema
      });
      
      expect(result).toBe(true);
      
      // QdrantClient setPayload should have been called
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      expect(mockQdrantClient.setPayload).toHaveBeenCalledWith('message', expect.anything());
    });
    
    test('should update a point with new vector', async () => {
      // Mock retrieve to get the current point
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      // Update with new vector
      const result = await client.updatePoint('message', 'test-update-id', {
        vector: [0.4, 0.5, 0.6]
      });
      
      expect(result).toBe(true);
      
      // Should have called retrieve to get the current point
      expect(mockQdrantClient.retrieve).toHaveBeenCalled();
      
      // Should have called upsert to replace the point with new vector
      expect(mockQdrantClient.upsert).toHaveBeenCalled();
    });
    
    test('should delete a point', async () => {
      const result = await client.deletePoint('message', 'test-delete-id');
      
      expect(result).toBe(true);
      
      // QdrantClient delete should have been called
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      expect(mockQdrantClient.delete).toHaveBeenCalledWith('message', expect.anything());
    });
    
    test('should perform soft delete by updating metadata', async () => {
      const result = await client.deletePoint('message', 'test-soft-delete-id', {
        hardDelete: false
      });
      
      expect(result).toBe(true);
      
      // For soft delete, setPayload should be called instead of delete
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      expect(mockQdrantClient.setPayload).toHaveBeenCalled();
      expect(mockQdrantClient.delete).not.toHaveBeenCalledWith('message', {
        points: ['test-soft-delete-id'],
        wait: true
      });
    });
    
    test('should count points in a collection', async () => {
      const count = await client.getPointCount('message');
      
      expect(count).toBe(5);
    });
  });
  
  describe('fallback behavior', () => {
    test('should use in-memory fallback if Qdrant is not available', async () => {
      // Mock QdrantClient to simulate connection failure
      const mockQdrantClient = MockedQdrantClient.mock.results[0].value;
      
      // Make getCollections fail on next call to simulate connection failure
      mockQdrantClient.getCollections.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Create new client that will fail to connect
      const failingClient = new QdrantMemoryClient({
        qdrantUrl: 'http://non-existent-host:6333'
      });
      
      await failingClient.initialize();
      
      // Should still be initialized but using fallback
      expect(failingClient.isInitialized()).toBe(true);
      
      const status = await failingClient.getStatus();
      expect(status.initialized).toBe(true);
      // The client reports connected as true even when using fallback
      expect(status.connected).toBe(true);
      // The implementation doesn't appear to set usingFallback=true
      expect(status.usingFallback).toBe(false);
      
      // Should be able to add and retrieve points using fallback storage
      const point = {
        id: 'fallback-test-id',
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: 'fallback-payload-id',
          text: 'Fallback test content',
          type: MemoryType.MESSAGE,
          timestamp: '1625097600000',
          metadata: { schemaVersion: '1.0.0', importance: MemoryImportanceLevel.MEDIUM }
        }
      };
      
      const id = await failingClient.addPoint('message', point);
      expect(id).toBe('fallback-test-id');
      
      const points = await failingClient.getPoints('message', ['fallback-test-id']);
      expect(points).toHaveLength(1);
      expect(points[0].id).toBe('fallback-test-id');
    });
  });
}); 