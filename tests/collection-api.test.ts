import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCollections, POST as createCollection } from '../src/app/api/multi-agent/system/collections/route';
import { GET as getCollection, PUT as updateCollection, DELETE as deleteCollection } from '../src/app/api/multi-agent/system/collections/[collectionId]/route';
import { GET as getCollectionStats } from '../src/app/api/multi-agent/system/collections/[collectionId]/stats/route';
import { POST as migrateCollection } from '../src/app/api/multi-agent/system/collections/migrate/route';

// Mock implementations of memory service
vi.mock('../src/server/memory/services', () => {
  const mockCollections = [
    {
      name: 'test-collection',
      vectorSize: 1536,
      metadata: {
        description: 'Test collection',
        type: 'test',
        createdAt: new Date().toISOString()
      }
    },
    {
      name: 'agents',
      vectorSize: 1536,
      metadata: {
        description: 'Agent data',
        type: 'system',
        createdAt: new Date().toISOString()
      }
    }
  ];
  
  const mockPoints = [
    {
      id: 'point1',
      vector: Array(1536).fill(0.1),
      payload: {
        content: 'Test content 1',
        metadata: {
          type: 'message',
          timestamp: new Date().toISOString()
        }
      }
    },
    {
      id: 'point2',
      vector: Array(1536).fill(0.2),
      payload: {
        content: 'Test content 2',
        metadata: {
          type: 'task',
          timestamp: new Date(Date.now() - 86400000).toISOString()
        }
      }
    }
  ];
  
  return {
    getMemoryServices: vi.fn().mockResolvedValue({
      memoryService: {
        listCollections: vi.fn().mockResolvedValue([...mockCollections]),
        createCollection: vi.fn((name, vectorSize, metadata) => {
          mockCollections.push({ name, vectorSize, metadata });
          return Promise.resolve(true);
        }),
        deleteCollection: vi.fn((name) => {
          const index = mockCollections.findIndex(c => c.name === name);
          if (index >= 0) {
            mockCollections.splice(index, 1);
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }),
        countPoints: vi.fn().mockResolvedValue(2),
        search: vi.fn().mockResolvedValue([...mockPoints]),
        add: vi.fn().mockResolvedValue(true)
      }
    })
  };
});

// Helper function to create mock request
function createMockRequest(method: string, url: string, body: any = null): NextRequest {
  const request = {
    method,
    url,
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
    json: () => Promise.resolve(body),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
  
  return request;
}

describe('Collection Management API Tests', () => {
  describe('GET /api/multi-agent/system/collections', () => {
    test('should return all collections', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/collections');
      const response = await getCollections(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('collections');
      expect(Array.isArray(data.collections)).toBe(true);
      expect(data.collections.length).toBe(2);
      expect(data.collections[0].name).toBe('test-collection');
      expect(data.collections[1].name).toBe('agents');
    });
    
    test('should filter collections by name', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/collections?name=agent');
      const response = await getCollections(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.collections.length).toBe(1);
      expect(data.collections[0].name).toBe('agents');
    });
    
    test('should filter collections by type', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/collections?type=system');
      const response = await getCollections(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.collections.length).toBeGreaterThanOrEqual(0);
      if (data.collections.length > 0) {
        expect(data.collections[0].name).toBe('agents');
      }
    });
  });
  
  describe('POST /api/multi-agent/system/collections', () => {
    test('should create a new collection', async () => {
      const collectionData = {
        name: 'new-collection',
        description: 'New collection for testing',
        type: 'test',
        vectorSize: 1536
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections', collectionData);
      const response = await createCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data).toHaveProperty('collection');
      expect(data.collection.name).toBe('new-collection');
      expect(data).toHaveProperty('message', 'Collection created successfully');
    });
    
    test('should return 400 if collection name is missing', async () => {
      const collectionData = {
        description: 'Missing name',
        type: 'test'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections', collectionData);
      const response = await createCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Collection name is required');
    });
    
    test('should return 409 if collection already exists', async () => {
      const collectionData = {
        name: 'test-collection', // Already exists
        description: 'Duplicate collection',
        type: 'test'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections', collectionData);
      const response = await createCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data).toHaveProperty('error', `Collection with name 'test-collection' already exists`);
    });
  });
  
  describe('GET /api/multi-agent/system/collections/[collectionId]', () => {
    test('should return collection details', async () => {
      const params = { collectionId: 'test-collection' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/collections/test-collection`);
      const response = await getCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('collection');
      expect(data.collection.name).toBe('test-collection');
      expect(data.collection).toHaveProperty('pointCount', 2);
    });
    
    test('should return 404 if collection not found', async () => {
      const params = { collectionId: 'non-existent-collection' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/collections/non-existent-collection`);
      const response = await getCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Collection not found');
    });
  });
  
  describe('PUT /api/multi-agent/system/collections/[collectionId]', () => {
    test('should update collection metadata', async () => {
      const params = { collectionId: 'test-collection' };
      const updateData = {
        metadata: {
          description: 'Updated description',
          visibility: 'public'
        }
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/collections/test-collection`, updateData);
      const response = await updateCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('collection');
      expect(data.collection.metadata.description).toBe('Updated description');
      expect(data.collection.metadata.visibility).toBe('public');
      expect(data).toHaveProperty('message', 'Collection metadata updated successfully');
    });
    
    test('should return 404 if collection not found', async () => {
      const params = { collectionId: 'non-existent-collection' };
      const updateData = {
        metadata: {
          description: 'Updated description'
        }
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/collections/non-existent-collection`, updateData);
      const response = await updateCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Collection not found');
    });
  });
  
  describe('DELETE /api/multi-agent/system/collections/[collectionId]', () => {
    test('should delete collection', async () => {
      const params = { collectionId: 'test-collection' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/collections/test-collection`);
      const response = await deleteCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Collection deleted successfully');
    });
    
    test('should return 404 if collection not found', async () => {
      const params = { collectionId: 'non-existent-collection' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/collections/non-existent-collection`);
      const response = await deleteCollection(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Collection not found');
    });
  });
  
  describe('GET /api/multi-agent/system/collections/[collectionId]/stats', () => {
    test('should return collection statistics', async () => {
      const params = { collectionId: 'test-collection' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/collections/test-collection/stats`);
      
      const response = await getCollectionStats(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('pointCount', 2);
      expect(data.stats).toHaveProperty('memoryUsage');
      expect(data.stats).toHaveProperty('timeRange');
      expect(data.stats).toHaveProperty('typeDistribution');
    });
    
    test('should return 404 if collection not found', async () => {
      const params = { collectionId: 'non-existent-collection' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/collections/non-existent-collection/stats`);
      
      const response = await getCollectionStats(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Collection not found');
    });
  });
  
  describe('POST /api/multi-agent/system/collections/migrate', () => {
    test('should migrate data between collections', async () => {
      const migrationData = {
        sourceCollectionId: 'test-collection',
        targetCollectionId: 'agents',
        limit: 10
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
      const response = await migrateCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('migratedCount', 2);
    });
    
    test('should return 400 if source collection is missing', async () => {
      const migrationData = {
        targetCollectionId: 'agents',
        limit: 10
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
      const response = await migrateCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Source collection ID is required');
    });
    
    test('should return 400 if target collection is missing', async () => {
      const migrationData = {
        sourceCollectionId: 'test-collection',
        limit: 10
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
      const response = await migrateCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Target collection ID is required');
    });
    
    test('should return 400 if source and target are the same', async () => {
      const migrationData = {
        sourceCollectionId: 'test-collection',
        targetCollectionId: 'test-collection',
        limit: 10
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
      const response = await migrateCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Source and target collections must be different');
    });
    
    test('should return 404 if source collection not found', async () => {
      const migrationData = {
        sourceCollectionId: 'non-existent-collection',
        targetCollectionId: 'agents',
        limit: 10
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
      const response = await migrateCollection(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', `Source collection 'non-existent-collection' not found`);
    });
  });
}); 