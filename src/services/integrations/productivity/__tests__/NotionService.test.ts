/**
 * NotionService.test.ts
 * Comprehensive test suite for NotionService
 * Following IMPLEMENTATION_GUIDELINES.md testing principles
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { NotionService } from '../NotionService';
import {
  NotionServiceConfig,
  PageCreationParams,
  DatabaseSchema,
  NotionQueryParams,
  createPageCreationParams,
  createDatabaseSchema
} from '../interfaces/NotionInterfaces';
import {
  NotionAuthenticationError,
  NotionValidationError,
  NotionRateLimitError,
  NotionResourceNotFoundError,
  NotionApiError
} from '../errors/NotionErrors';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Test configuration
const testConfig: NotionServiceConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.notion.com',
  timeout: 30000,
  retryAttempts: 3,
  rateLimitBuffer: 5
};

// Mock data
const mockPage = {
  id: 'page-123',
  object: 'page',
  created_time: '2023-01-01T00:00:00.000Z',
  last_edited_time: '2023-01-01T00:00:00.000Z',
  archived: false,
  parent: { type: 'database_id', database_id: 'db-123' },
  properties: {
    title: {
      id: 'title',
      type: 'title',
      title: [{ type: 'text', text: { content: 'Test Page' }, plain_text: 'Test Page' }]
    }
  },
  url: 'https://notion.so/page-123'
};

const mockDatabase = {
  id: 'db-123',
  object: 'database',
  created_time: '2023-01-01T00:00:00.000Z',
  last_edited_time: '2023-01-01T00:00:00.000Z',
  archived: false,
  title: [{ type: 'text', text: { content: 'Test Database' }, plain_text: 'Test Database' }],
  description: [],
  properties: {
    Name: {
      id: 'title',
      name: 'Name',
      type: 'title'
    }
  },
  parent: { type: 'workspace', workspace: true },
  url: 'https://notion.so/db-123',
  is_inline: false
};

describe('NotionService', () => {
  let notionService: NotionService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    };
    
    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    
    notionService = new NotionService(testConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(notionService).toBeInstanceOf(NotionService);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: testConfig.baseUrl,
        timeout: testConfig.timeout,
        headers: {
          'Authorization': `Bearer ${testConfig.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      });
    });

    it('should throw configuration error for missing API key', () => {
      const invalidConfig = { ...testConfig, apiKey: '' };
      expect(() => new NotionService(invalidConfig)).toThrow(NotionAuthenticationError);
    });

    it('should throw configuration error for invalid timeout', () => {
      const invalidConfig = { ...testConfig, timeout: 500 };
      expect(() => new NotionService(invalidConfig)).toThrow(NotionValidationError);
    });

    it('should use default configuration values', () => {
      const minimalConfig: NotionServiceConfig = { apiKey: 'test-key' };
      const service = new NotionService(minimalConfig);
      expect(service).toBeInstanceOf(NotionService);
    });
  });

  describe('createPage', () => {
    const validParams = createPageCreationParams(
      { type: 'database_id', database_id: 'db-123' },
      {
        Name: {
          id: 'title',
          type: 'title',
          title: [{ type: 'text', text: { content: 'Test Page' } }]
        }
      }
    );

    it('should create a page successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockPage });

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPage);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/pages', validParams);
    });

    it('should handle validation errors', async () => {
      const invalidParams = { ...validParams, parent: undefined } as any;

      const result = await notionService.createPage(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });

    it('should handle API authentication errors', async () => {
      const apiError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionAuthenticationError');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Rate limited' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(rateLimitError);

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionRateLimitError');
    });

    it('should retry on retryable errors', async () => {
      mockAxiosInstance.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockResolvedValue({ data: mockPage });

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should include children blocks in page creation', async () => {
      const paramsWithChildren = {
        ...validParams,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: 'Hello world' } }]
            }
          }
        ]
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockPage });

      const result = await notionService.createPage(paramsWithChildren);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/pages', paramsWithChildren);
    });
  });

  describe('queryDatabase', () => {
    const databaseId = 'db-123';
    const mockQueryResponse = {
      object: 'list',
      results: [mockPage],
      next_cursor: null,
      has_more: false,
      request_id: 'req-123'
    };

    it('should query database successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockQueryResponse });

      const result = await notionService.queryDatabase(databaseId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQueryResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/v1/databases/${databaseId}/query`,
        { page_size: 100 }
      );
    });

    it('should query database with filters and sorts', async () => {
      const queryParams: NotionQueryParams = {
        filter: {
          property: 'Status',
          select: { equals: 'Done' }
        },
        sorts: [
          { property: 'Created', direction: 'descending' }
        ],
        page_size: 50
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockQueryResponse });

      const result = await notionService.queryDatabase(databaseId, queryParams);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/v1/databases/${databaseId}/query`,
        queryParams
      );
    });

    it('should handle empty database ID', async () => {
      const result = await notionService.queryDatabase('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });

    it('should handle database not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Database not found' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(notFoundError);

      const result = await notionService.queryDatabase(databaseId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionResourceNotFoundError');
    });
  });

  describe('createDatabase', () => {
    const validSchema = createDatabaseSchema(
      'Test Database',
      {
        Name: {
          id: 'title',
          name: 'Name',
          type: 'title'
        },
        Status: {
          id: 'status',
          name: 'Status',
          type: 'select',
          select: {
            options: [
              { name: 'Not started', color: 'red' },
              { name: 'In progress', color: 'yellow' },
              { name: 'Done', color: 'green' }
            ]
          }
        }
      },
      { type: 'workspace', workspace: true }
    );

    it('should create database successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockDatabase });

      const result = await notionService.createDatabase(validSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDatabase);
    });

    it('should create database with description and icon', async () => {
      const schemaWithExtras = {
        ...validSchema,
        description: 'A test database',
        icon: { type: 'emoji', emoji: '📝' }
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockDatabase });

      const result = await notionService.createDatabase(schemaWithExtras);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/databases', expect.objectContaining({
        title: [{ type: 'text', text: { content: validSchema.title } }],
        description: [{ type: 'text', text: { content: 'A test database' } }],
        icon: { type: 'emoji', emoji: '📝' }
      }));
    });

    it('should handle invalid schema', async () => {
      const invalidSchema = { ...validSchema, title: '' };

      const result = await notionService.createDatabase(invalidSchema);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });

    it('should handle missing properties', async () => {
      const invalidSchema = { ...validSchema, properties: {} };

      const result = await notionService.createDatabase(invalidSchema);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('getPage', () => {
    const pageId = 'page-123';

    it('should retrieve page successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockPage });

      const result = await notionService.getPage(pageId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPage);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/pages/${pageId}`);
    });

    it('should handle empty page ID', async () => {
      const result = await notionService.getPage('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });

    it('should handle page not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Page not found' }
        }
      };
      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      const result = await notionService.getPage(pageId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionResourceNotFoundError');
    });
  });

  describe('getDatabase', () => {
    const databaseId = 'db-123';

    it('should retrieve database successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockDatabase });

      const result = await notionService.getDatabase(databaseId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDatabase);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/databases/${databaseId}`);
    });

    it('should handle empty database ID', async () => {
      const result = await notionService.getDatabase('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('updatePage', () => {
    const pageId = 'page-123';
    const properties = {
      Status: {
        id: 'status',
        type: 'select',
        select: { name: 'Done' }
      }
    };

    it('should update page successfully', async () => {
      const updatedPage = { ...mockPage, properties: { ...mockPage.properties, ...properties } };
      mockAxiosInstance.patch.mockResolvedValue({ data: updatedPage });

      const result = await notionService.updatePage(pageId, properties);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedPage);
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(`/v1/pages/${pageId}`, { properties });
    });

    it('should handle empty properties', async () => {
      const result = await notionService.updatePage(pageId, {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('getBlockChildren', () => {
    const blockId = 'block-123';
    const mockBlocksResponse = {
      object: 'list',
      results: [
        {
          id: 'child-block-1',
          object: 'block',
          type: 'paragraph',
          created_time: '2023-01-01T00:00:00.000Z',
          last_edited_time: '2023-01-01T00:00:00.000Z',
          archived: false,
          has_children: false,
          parent: { type: 'page_id', page_id: blockId }
        }
      ],
      next_cursor: null,
      has_more: false
    };

    it('should retrieve block children successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockBlocksResponse });

      const result = await notionService.getBlockChildren(blockId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocksResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/blocks/${blockId}/children`);
    });

    it('should handle empty block ID', async () => {
      const result = await notionService.getBlockChildren('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('search', () => {
    const query = 'test search';
    const mockSearchResponse = {
      object: 'list',
      results: [mockPage, mockDatabase],
      next_cursor: null,
      has_more: false
    };

    it('should search successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });

      const result = await notionService.search(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSearchResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/search', {
        query,
        page_size: 100
      });
    });

    it('should search with filter', async () => {
      const filter = { property: 'object', value: 'page' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });

      const result = await notionService.search(query, filter);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/search', {
        query,
        filter,
        page_size: 100
      });
    });

    it('should handle empty search query', async () => {
      const result = await notionService.search('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'user-123' } });

      const healthStatus = await notionService.getHealthStatus();

      expect(healthStatus.isHealthy).toBe(true);
      expect(healthStatus.lastChecked).toBeInstanceOf(Date);
      expect(healthStatus.responseTime).toBeGreaterThan(0);
      expect(healthStatus.rateLimitStatus).toBeDefined();
    });

    it('should return unhealthy status on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Service unavailable'));

      const healthStatus = await notionService.getHealthStatus();

      expect(healthStatus.isHealthy).toBe(false);
      expect(healthStatus.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should wait when rate limit is approaching', async () => {
      // Mock rate limit headers
      const rateLimitHeaders = {
        'x-ratelimit-remaining': '5',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: mockPage,
        headers: rateLimitHeaders
      });

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);
      expect(result.success).toBe(true);
    });

    it('should handle rate limit exceeded error', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '1' },
          data: { message: 'Rate limit exceeded' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(rateLimitError);

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionRateLimitError');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionNetworkError');
    });

    it('should handle timeout errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({ code: 'ECONNABORTED' });

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionNetworkError');
    });

    it('should handle validation errors for bad request', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { message: 'Invalid request body' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(validationError);

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NotionValidationError');
    });
  });

  describe('Retry Logic', () => {
    it('should not retry on non-retryable errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(authError);

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retry attempts on persistent errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({ response: { status: 500 } });

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(result.success).toBe(false);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // Default retry attempts
    });
  });

  describe('Immutability', () => {
    it('should not mutate input parameters', async () => {
      const originalParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );
      const paramsCopy = JSON.parse(JSON.stringify(originalParams));
      
      mockAxiosInstance.post.mockResolvedValue({ data: mockPage });

      await notionService.createPage(originalParams);

      expect(originalParams).toEqual(paramsCopy);
    });

    it('should return immutable response objects', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockPage });

      const validParams = createPageCreationParams(
        { type: 'database_id', database_id: 'db-123' },
        { Name: { id: 'title', type: 'title' } }
      );

      const result = await notionService.createPage(validParams);

      expect(() => {
        (result.data as any).id = 'modified';
      }).toThrow();
    });
  });
}); 