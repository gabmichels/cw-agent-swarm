// TypeformService test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';
import { TypeformService } from '../TypeformService';
import {
  TypeformCreationParams,
  FormResult,
  FormId,
  TypeformConfig
} from '../interfaces/BusinessInterfaces';
import {
  FormNotFoundError,
  TypeformError
} from '../errors/BusinessErrors';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the logger
vi.mock('../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('TypeformService', () => {
  let service: TypeformService;
  let mockConfig: TypeformConfig;

  const mockFormId = `form_${ulid()}` as FormId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    mockConfig = {
      accessToken: 'test-access-token',
      workspaceId: 'test-workspace-id'
    };

    service = new TypeformService(mockConfig);
  });

  describe('Connection Validation and Health', () => {
    it('should validate connection successfully', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alias: 'test-user' })
      });

      // Act
      const result = await service.validateConnection();

      // Assert
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.typeform.com/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
    });

    it('should get health status when healthy', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((header) => {
            if (header === 'X-RateLimit-Remaining') return '900';
            if (header === 'X-RateLimit-Reset') return '1640995200';
            return null;
          })
        },
        json: async () => ({ alias: 'test-user' })
      });

      // Act
      const result = await service.getHealthStatus();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          isHealthy: true,
          responseTime: expect.any(Number),
          rateLimitStatus: expect.objectContaining({
            remaining: 900,
            isThrottled: false
          })
        })
      );
    });
  });

  describe('Form Creation', () => {
    it('should create form successfully', async () => {
      // Arrange
      const formParams: TypeformCreationParams = {
        formId: mockFormId,
        title: 'Test Form',
        description: 'A test form',
        fields: [
          {
            id: 'field1',
            type: 'short_text',
            title: 'What is your name?',
            required: true
          },
          {
            id: 'field2',
            type: 'email',
            title: 'What is your email?',
            required: true
          }
        ],
        settings: {
          isPublic: true,
          isTrialForm: false,
          language: 'en',
          progressBar: 'percentage',
          showProgressBar: true,
          showTypeformBranding: true,
          meta: {
            allowIndexing: true
          }
        }
      };

      const mockCreatedForm = {
        id: 'tf_test123',
        title: 'Test Form',
        language: 'en',
        fields: [],
        settings: {},
        theme: {},
        workspace: { href: 'https://api.typeform.com/workspaces/test' },
        _links: {
          display: 'https://test.typeform.com/to/test123'
        },
        created_at: '2024-01-01T10:00:00Z',
        last_updated_at: '2024-01-01T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCreatedForm
      });

      // Act
      const result = await service.createForm(formParams);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          formId: mockFormId,
          typeformId: 'tf_test123',
          title: 'Test Form',
          status: 'draft',
          publicUrl: 'https://test.typeform.com/to/test123',
          embedUrl: 'https://embed.typeform.com/to/tf_test123'
        })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.typeform.com/forms',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json'
          }),
          body: expect.any(String)
        })
      );
    });

    it('should handle form creation errors', async () => {
      // Arrange
      const formParams: TypeformCreationParams = {
        formId: mockFormId,
        title: 'Test Form',
        fields: [],
        settings: {
          isPublic: true,
          isTrialForm: false,
          language: 'en',
          progressBar: 'percentage',
          showProgressBar: true,
          showTypeformBranding: true,
          meta: { allowIndexing: true }
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid form data' })
      });

      // Act & Assert
      await expect(service.createForm(formParams)).rejects.toThrow(TypeformError);
    });
  });

  describe('Form Retrieval', () => {
    it('should get form successfully', async () => {
      // Arrange
      const mockForm = {
        id: 'tf_test123',
        title: 'Test Form',
        language: 'en',
        fields: [],
        settings: {},
        theme: {},
        workspace: { href: 'https://api.typeform.com/workspaces/test' },
        _links: {
          display: 'https://test.typeform.com/to/test123'
        },
        created_at: '2024-01-01T10:00:00Z',
        last_updated_at: '2024-01-01T10:00:00Z',
        published_at: '2024-01-01T12:00:00Z'
      };

      const mockStats = {
        total_responses: 25,
        completion_rate: 85
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockForm
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStats
        });

      // Act
      const result = await service.getForm(mockFormId);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          formId: mockFormId,
          typeformId: 'tf_test123',
          title: 'Test Form',
          status: 'published',
          responseCount: 25,
          completionRate: 85
        })
      );
    });

    it('should handle form not found', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      // Act & Assert
      await expect(service.getForm(mockFormId)).rejects.toThrow(FormNotFoundError);
    });
  });

  describe('Form Responses', () => {
    it('should get form responses successfully', async () => {
      // Arrange
      const mockResponses = {
        items: [
          {
            form_id: 'tf_test123',
            token: 'response_token_123',
            landed_at: '2024-01-01T10:00:00Z',
            submitted_at: '2024-01-01T10:05:00Z',
            metadata: {
              user_agent: 'Mozilla/5.0',
              platform: 'web',
              referer: 'https://example.com',
              network_id: 'network123',
              browser: 'Chrome'
            },
            answers: [
              {
                field: {
                  id: 'field1',
                  type: 'short_text',
                  ref: 'field1'
                },
                type: 'text',
                text: 'John Doe'
              }
            ]
          }
        ]
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponses
      });

      // Act
      const result = await service.getFormResponses(mockFormId, 10);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          responseId: 'response_response_token_123',
          formId: mockFormId,
          answers: expect.arrayContaining([
            expect.objectContaining({
              fieldId: 'field1',
              fieldType: 'short_text',
              value: 'John Doe',
              text: 'John Doe'
            })
          ])
        })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.typeform.com/forms/'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });
});
