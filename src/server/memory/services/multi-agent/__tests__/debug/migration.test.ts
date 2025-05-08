import { test, expect, describe, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as migrateCollection } from '../../../../../../app/api/multi-agent/system/collections/migrate/route';

// Mock implementations of memory service
vi.mock('../../../../../../server/memory/services', () => {
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
        listCollections: vi.fn().mockResolvedValue(mockCollections),
        countPoints: vi.fn().mockResolvedValue(2),
        search: vi.fn().mockResolvedValue(mockPoints),
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

describe('Migration Route Handler Test', () => {
  test('POST /api/multi-agent/system/collections/migrate should migrate data', async () => {
    const migrationData = {
      sourceCollectionId: 'test-collection',
      targetCollectionId: 'agents',
      limit: 10
    };
    
    const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
    
    console.log('Running migration test with data:', migrationData);
    
    const response = await migrateCollection(request);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('migratedCount', 2);
  });
  
  test('POST /api/multi-agent/system/collections/migrate with transform should transform data', async () => {
    const migrationData = {
      sourceCollectionId: 'test-collection',
      targetCollectionId: 'agents',
      transform: {
        type: 'addField',
        options: {
          field: 'migrated',
          value: true
        }
      }
    };
    
    const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/collections/migrate', migrationData);
    
    console.log('Running migration test with transform data:', migrationData);
    
    const response = await migrateCollection(request);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('migratedCount', 2);
  });
}); 