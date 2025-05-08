/**
 * Tests for the memory context API endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryErrorCode } from '../../../../../server/memory/config';
import * as memoryServices from '../../../../../server/memory/services';
import { GET, POST } from '../route';

// Mock the memory services
vi.mock('../../../../../server/memory/services', () => ({
  getMemoryServices: vi.fn()
}));

describe('Memory Context API Endpoints', () => {
  // Sample memory context result
  const sampleContext = {
    contextId: 'ctx_123',
    timestamp: Date.now(),
    groups: [
      {
        name: 'Group 1',
        description: 'Test group 1',
        memories: [],
        relevance: 0.9
      }
    ],
    summary: 'Test summary',
    metadata: {
      query: 'test query',
      totalMemoriesFound: 10,
      strategy: 'topic'
    }
  };

  // Mock search service
  const mockSearchService = {
    getMemoryContext: vi.fn().mockResolvedValue(sampleContext)
  };

  // Setup before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup the mock implementation
    (memoryServices.getMemoryServices as any).mockResolvedValue({
      searchService: mockSearchService
    });
  });

  describe('GET endpoint', () => {
    it('should return memory context when query is provided', async () => {
      // Create mock request with query parameters
      const request = new NextRequest(
        new URL('http://localhost/api/memory/context?query=test&includeSummary=true')
      );

      // Call the GET handler
      const response = await GET(request);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        context: sampleContext,
        success: true
      });

      // Verify the search service was called with correct parameters
      expect(mockSearchService.getMemoryContext).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          includeSummary: true
        })
      );
    });

    it('should handle errors properly', async () => {
      // Mock error from search service
      mockSearchService.getMemoryContext.mockRejectedValueOnce({
        code: MemoryErrorCode.VALIDATION_ERROR,
        message: 'Invalid parameters'
      });

      // Create mock request
      const request = new NextRequest(
        new URL('http://localhost/api/memory/context?query=test')
      );

      // Call the GET handler
      const response = await GET(request);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(responseData).toEqual({
        error: 'Invalid parameters',
        success: false
      });
    });

    it('should handle filter parameters', async () => {
      // Create mock request with filter parameters
      const url = new URL('http://localhost/api/memory/context');
      url.searchParams.append('filter.metadata.tags', 'test');
      url.searchParams.append('filter.timestamp', '123456789');
      
      const request = new NextRequest(url);

      // Call the GET handler
      await GET(request);

      // Verify the search service was called with correct filter parameters
      expect(mockSearchService.getMemoryContext).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            'metadata.tags': 'test',
            'timestamp': '123456789'
          }
        })
      );
    });
  });

  describe('POST endpoint', () => {
    it('should return memory context when body has valid query', async () => {
      // Create mock request with JSON body
      const requestBody = {
        query: 'test query',
        types: ['MESSAGE', 'THOUGHT'],
        maxMemoriesPerGroup: 3,
        includeSummary: true,
        groupingStrategy: 'topic'
      };

      const request = new NextRequest(
        'http://localhost/api/memory/context',
        {
          method: 'POST',
          body: JSON.stringify(requestBody)
        }
      );

      // Call the POST handler
      const response = await POST(request);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        context: sampleContext,
        success: true
      });

      // Verify the search service was called with correct parameters
      expect(mockSearchService.getMemoryContext).toHaveBeenCalledWith(
        expect.objectContaining(requestBody)
      );
    });

    it('should return 400 when neither query nor filter is provided', async () => {
      // Create mock request with empty body
      const request = new NextRequest(
        'http://localhost/api/memory/context',
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );

      // Call the POST handler
      const response = await POST(request);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(400);
      expect(responseData).toEqual({
        error: 'Either query or filter must be provided',
        success: false
      });
    });

    it('should handle complex filters', async () => {
      // Create mock request with filter
      const requestBody = {
        filter: {
          'metadata.tags': { '$contains': 'test' },
          'timestamp': { '$gte': 123456789 }
        },
        groupingStrategy: 'custom',
        includedGroups: ['group1', 'group2']
      };

      const request = new NextRequest(
        'http://localhost/api/memory/context',
        {
          method: 'POST',
          body: JSON.stringify(requestBody)
        }
      );

      // Call the POST handler
      await POST(request);

      // Verify the search service was called with correct parameters
      expect(mockSearchService.getMemoryContext).toHaveBeenCalledWith(
        expect.objectContaining(requestBody)
      );
    });
  });
}); 