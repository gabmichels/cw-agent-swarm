/**
 * Unit tests for VectorDatabaseAdapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorDatabaseAdapter } from '../vector-db-adapter';
import { StructuredId } from '../../../../../utils/ulid';

describe('VectorDatabaseAdapter', () => {
  // Mock memory client
  const mockMemoryClient = {
    addPoint: vi.fn().mockImplementation(() => Promise.resolve('test-id')),
    getPoints: vi.fn().mockImplementation(() => Promise.resolve([
      {
        id: 'test-id-1',
        vector: [0.1, 0.2, 0.3],
        payload: {
          text: 'Test document 1',
          type: 'test',
          metadata: { source: 'test' }
        }
      },
      {
        id: 'test-id-2',
        vector: [0.4, 0.5, 0.6],
        payload: {
          text: 'Test document 2',
          type: 'test',
          metadata: { source: 'test' }
        }
      }
    ])),
    searchPoints: vi.fn().mockImplementation(() => Promise.resolve([
      {
        id: 'test-id-1',
        score: 0.95,
        payload: {
          text: 'Test document 1',
          type: 'test',
          metadata: { source: 'test' }
        }
      },
      {
        id: 'test-id-2',
        score: 0.82,
        payload: {
          text: 'Test document 2', 
          type: 'test',
          metadata: { source: 'test' }
        }
      }
    ])),
    updatePoint: vi.fn().mockImplementation(() => Promise.resolve(true)),
    deletePoint: vi.fn().mockImplementation(() => Promise.resolve(true))
  };
  
  let adapter: VectorDatabaseAdapter;
  
  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();
    
    // Create adapter with mock client
    adapter = new VectorDatabaseAdapter(mockMemoryClient as any);
  });
  
  describe('addPoint', () => {
    it('should adapt and forward the request to the memory client', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const point = {
        id: 'test-id',
        vector: [0.1, 0.2, 0.3],
        payload: {
          text: 'Test document',
          source: 'test'
        }
      };
      
      // Call adapter method
      const result = await adapter.addPoint(collectionName, point);
      
      // Verify result
      expect(result).toBe('test-id');
      
      // Verify memory client was called with adapted data
      expect(mockMemoryClient.addPoint).toHaveBeenCalledWith(
        collectionName,
        expect.objectContaining({
          id: 'test-id',
          vector: [0.1, 0.2, 0.3],
          payload: expect.objectContaining({
            id: 'test-id',
            text: 'Test document'
          })
        })
      );
    });
  });
  
  describe('getPoints', () => {
    it('should forward the request and adapt the results', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const ids = ['test-id-1', 'test-id-2'];
      
      // Call adapter method
      const results = await adapter.getPoints(collectionName, ids);
      
      // Verify memory client was called
      expect(mockMemoryClient.getPoints).toHaveBeenCalledWith(collectionName, ids);
      
      // Verify results were adapted correctly
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'test-id-1',
        vector: [0.1, 0.2, 0.3],
        payload: expect.objectContaining({
          text: 'Test document 1',
          type: 'test'
        })
      });
    });
  });
  
  describe('search', () => {
    it('should perform search and adapt results', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const vector = [0.1, 0.2, 0.3];
      const limit = 10;
      const filter = { field: 'test' };
      const scoreThreshold = 0.7;
      
      // Call adapter method
      const results = await adapter.search(
        collectionName,
        vector,
        limit,
        filter,
        scoreThreshold
      );
      
      // Verify memory client was called
      expect(mockMemoryClient.searchPoints).toHaveBeenCalledWith(
        collectionName,
        {
          vector,
          filter,
          limit,
          scoreThreshold
        }
      );
      
      // Verify results format
      expect(results).toHaveProperty('matches');
      expect(results).toHaveProperty('totalCount', 2);
      expect(results.matches).toHaveLength(2);
      
      // Verify match structure
      const match = results.matches[0];
      expect(match).toHaveProperty('id', 'test-id-1');
      expect(match).toHaveProperty('score', 0.95);
      expect(match).toHaveProperty('payload');
    });
  });
  
  describe('searchPoints', () => {
    it('should perform search with options and adapt results', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const vector = [0.1, 0.2, 0.3];
      const options = {
        limit: 10,
        scoreThreshold: 0.7
      };
      
      // Call adapter method
      const results = await adapter.searchPoints(
        collectionName,
        vector,
        options
      );
      
      // Verify memory client was called
      expect(mockMemoryClient.searchPoints).toHaveBeenCalledWith(
        collectionName,
        {
          vector,
          limit: options.limit,
          scoreThreshold: options.scoreThreshold
        }
      );
      
      // Verify results format
      expect(results).toHaveLength(2);
      
      // Verify result structure
      const result = results[0];
      expect(result).toHaveProperty('id', 'test-id-1');
      expect(result).toHaveProperty('vector'); // Empty in our adapter implementation
      expect(result).toHaveProperty('payload');
    });
  });
  
  describe('updatePoint', () => {
    it('should adapt and forward update request', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const id = 'test-id';
      const updates = {
        vector: [0.7, 0.8, 0.9],
        payload: {
          text: 'Updated document'
        }
      };
      
      // Call adapter method
      const result = await adapter.updatePoint(collectionName, id, updates);
      
      // Verify result
      expect(result).toBe(true);
      
      // Verify memory client was called with adapted data
      expect(mockMemoryClient.updatePoint).toHaveBeenCalledWith(
        collectionName,
        id,
        expect.objectContaining({
          vector: [0.7, 0.8, 0.9],
          payload: expect.any(Object)
        })
      );
    });
  });
  
  describe('deletePoint', () => {
    it('should forward delete request', async () => {
      // Setup test data
      const collectionName = 'test-collection';
      const id = 'test-id';
      const options = { hardDelete: true };
      
      // Call adapter method
      const result = await adapter.deletePoint(collectionName, id, options);
      
      // Verify result
      expect(result).toBe(true);
      
      // Verify memory client was called
      expect(mockMemoryClient.deletePoint).toHaveBeenCalledWith(
        collectionName,
        id,
        options
      );
    });
  });
}); 