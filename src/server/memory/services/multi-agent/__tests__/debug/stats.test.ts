import { test, expect, describe, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCollectionStats } from '../../../../../../app/api/multi-agent/system/collections/[collectionId]/stats/route';

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
        search: vi.fn().mockResolvedValue(mockPoints)
      }
    })
  };
});

// Helper function to create mock request
function createMockRequest(method: string, url: string): NextRequest {
  const request = {
    method,
    url,
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
  
  return request;
}

describe('Stats Route Handler Test', () => {
  test('GET /api/multi-agent/system/collections/[collectionId]/stats returns correct data', async () => {
    const params = { collectionId: 'test-collection' };
    const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/collections/test-collection/stats`);
    
    console.log('Running stats test with params:', params);
    
    const response = await getCollectionStats(request, { params });
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('stats');
    expect(data.stats).toHaveProperty('pointCount', 2);
  });
}); 