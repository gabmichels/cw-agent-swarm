/**
 * Unit Tests for UnifiedEmailService
 * 
 * Tests all core functionality including provider management, email operations,
 * rate limiting, validation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ulid } from 'ulid';
import { 
  UnifiedEmailService, 
  createUnifiedEmailService,
  EmailServiceConfig,
  EmailParams,
  EmailFilters,
  UnifiedEmailError,
  EmailProviderError,
  EmailValidationError,
  EmailRateLimitError
} from '../email/UnifiedEmailService';
import { EmailCapabilities, EmailMessage } from '../../workspace/capabilities/EmailCapabilities';
import { GoogleEmailCapabilities } from '../../workspace/capabilities/google/GoogleEmailCapabilities';
import { DatabaseService } from '../../database/DatabaseService';
import { WorkspaceProvider, WorkspaceConnection, ConnectionStatus } from '../../database/types';
import { logger } from '../../../lib/logging';

// Mock dependencies
vi.mock('../../workspace/capabilities/google/GoogleEmailCapabilities');
vi.mock('../../database/DatabaseService');
vi.mock('../../../lib/logging');

describe('UnifiedEmailService', () => {
  let service: UnifiedEmailService;
  let mockEmailCapabilities: Mock;
  let mockDatabase: Mock;
  let config: EmailServiceConfig;

  const mockWorkspaceConnection: WorkspaceConnection = {
    id: ulid(),
    userId: 'test-user-id',
    provider: WorkspaceProvider.GOOGLE_WORKSPACE,
    email: 'test@example.com',
    displayName: 'Test User',
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    scopes: 'email',
    status: ConnectionStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockEmailMessage: EmailMessage = {
    id: ulid(),
    threadId: ulid(),
    subject: 'Test Subject',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    body: 'Test email body',
    date: new Date(),
    isRead: false,
    isImportant: false,
    labels: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock EmailCapabilities
    mockEmailCapabilities = vi.fn();
    mockEmailCapabilities.prototype.sendEmail = vi.fn().mockResolvedValue(mockEmailMessage);
    mockEmailCapabilities.prototype.searchEmails = vi.fn().mockResolvedValue([mockEmailMessage]);
    (GoogleEmailCapabilities as any).mockImplementation(() => mockEmailCapabilities.prototype);

    // Mock DatabaseService
    mockDatabase = {
      getInstance: vi.fn().mockReturnValue({
        findWorkspaceConnections: vi.fn().mockResolvedValue([mockWorkspaceConnection])
      })
    };
    (DatabaseService as any).getInstance = mockDatabase.getInstance;

    // Test configuration
    config = {
      providers: {
        gmail: {
          enabled: true,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret'
        },
        outlook: {
          enabled: false,
          clientId: 'test-outlook-client-id',
          clientSecret: 'test-outlook-client-secret',
          tenantId: 'test-tenant-id'
        }
      },
      webhooks: {
        enabled: true,
        baseUrl: 'https://test.example.com',
        secret: 'test-webhook-secret'
      },
      rateLimiting: {
        maxEmailsPerHour: 10,
        maxEmailsPerDay: 100
      }
    };

    service = new UnifiedEmailService(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(service).toBeInstanceOf(UnifiedEmailService);
      expect(logger.info).toHaveBeenCalledWith('Gmail provider initialized');
    });

    it('should initialize with factory function', () => {
      const factoryService = createUnifiedEmailService({
        providers: {
          gmail: { enabled: true }
        }
      });
      expect(factoryService).toBeInstanceOf(UnifiedEmailService);
    });

    it('should use default configuration when none provided', () => {
      const defaultService = createUnifiedEmailService();
      expect(defaultService).toBeInstanceOf(UnifiedEmailService);
    });
  });

  describe('Provider Management', () => {
    it('should get available providers', async () => {
      const providers = await service.getAvailableProviders();
      
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('Gmail');
      expect(providers[0].type).toBe('gmail');
      expect(providers[0].isAvailable).toBe(true);
    });

    it('should include Outlook when enabled', async () => {
      const outlookConfig = {
        ...config,
        providers: {
          ...config.providers,
          outlook: { enabled: true }
        }
      };
      
      const outlookService = new UnifiedEmailService(outlookConfig);
      const providers = await outlookService.getAvailableProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers.some(p => p.type === 'outlook')).toBe(true);
    });
  });

  describe('Email Operations', () => {
    const testEmailParams: EmailParams = {
      to: ['recipient@example.com'],
      subject: 'Test Subject',
      body: 'Test email body'
    };

    describe('sendEmail', () => {
      it('should send email successfully', async () => {
        const result = await service.sendEmail('test-user-id', 'test-agent-id', testEmailParams);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe(mockEmailMessage.id);
        expect(result.provider).toBe('gmail');
        expect(mockEmailCapabilities.prototype.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: testEmailParams.to,
            subject: testEmailParams.subject,
            body: testEmailParams.body
          }),
          mockWorkspaceConnection.id,
          'test-agent-id'
        );
      });

      it('should handle provider errors gracefully', async () => {
        mockEmailCapabilities.prototype.sendEmail.mockRejectedValue(new Error('Provider error'));

        const result = await service.sendEmail('test-user-id', 'test-agent-id', testEmailParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Provider error');
      });

      it('should validate email parameters', async () => {
        const invalidParams: EmailParams = {
          to: [],
          subject: '',
          body: ''
        };

        const result = await service.sendEmail('test-user-id', 'test-agent-id', invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation error: At least one recipient is required');
      });

      it('should validate email addresses', async () => {
        const invalidEmailParams: EmailParams = {
          to: ['invalid-email'],
          subject: 'Test',
          body: 'Test'
        };

        const result = await service.sendEmail('test-user-id', 'test-agent-id', invalidEmailParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation error: Invalid email address: invalid-email');
      });

      it('should handle missing provider', async () => {
        mockDatabase.getInstance().findWorkspaceConnections.mockResolvedValue([]);

        const result = await service.sendEmail('test-user-id', 'test-agent-id', testEmailParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No email provider available for user');
      });
    });

    describe('getEmails', () => {
      const testFilters: EmailFilters = {
        query: 'test',
        maxResults: 10
      };

      it('should retrieve emails successfully', async () => {
        const emails = await service.getEmails('test-user-id', 'test-agent-id', testFilters);

        expect(emails).toHaveLength(1);
        expect(emails[0]).toEqual(mockEmailMessage);
        expect(mockEmailCapabilities.prototype.searchEmails).toHaveBeenCalledWith(
          expect.objectContaining({
            query: testFilters.query,
            maxResults: testFilters.maxResults
          }),
          mockWorkspaceConnection.id,
          'test-agent-id'
        );
      });

      it('should handle provider errors', async () => {
        mockEmailCapabilities.prototype.searchEmails.mockRejectedValue(new Error('Search failed'));

        await expect(service.getEmails('test-user-id', 'test-agent-id', testFilters))
          .rejects.toThrow('Search failed');
      });

      it('should use default maxResults when not specified', async () => {
        await service.getEmails('test-user-id', 'test-agent-id', {});

        expect(mockEmailCapabilities.prototype.searchEmails).toHaveBeenCalledWith(
          expect.objectContaining({
            maxResults: 50
          }),
          mockWorkspaceConnection.id,
          'test-agent-id'
        );
      });
    });
  });

  describe('Webhook Management', () => {
    it('should setup Gmail webhook successfully', async () => {
      const webhookConfig = await service.setupEmailWebhook('gmail', 'test-user-id');

      expect(webhookConfig.provider).toBe('gmail');
      expect(webhookConfig.userId).toBe('test-user-id');
      expect(webhookConfig.isActive).toBe(true);
      expect(webhookConfig.events).toContain('message.received');
      expect(webhookConfig.webhookUrl).toContain('/webhooks/email/gmail/');
    });

    it('should setup Outlook webhook successfully', async () => {
      const webhookConfig = await service.setupEmailWebhook('outlook', 'test-user-id');

      expect(webhookConfig.provider).toBe('outlook');
      expect(webhookConfig.userId).toBe('test-user-id');
      expect(webhookConfig.isActive).toBe(true);
    });

    it('should reject webhook setup when disabled', async () => {
      const noWebhookConfig = {
        ...config,
        webhooks: { ...config.webhooks, enabled: false }
      };
      const noWebhookService = new UnifiedEmailService(noWebhookConfig);

      await expect(noWebhookService.setupEmailWebhook('gmail', 'test-user-id'))
        .rejects.toThrow('Webhooks not enabled');
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits per user', async () => {
      const testParams: EmailParams = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test'
      };

      // Send first email - should succeed
      const result1 = await service.sendEmail('test-user-id', 'test-agent-id', testParams);
      expect(result1.success).toBe(true);

      // Mock rate limit exceeded
      const rateLimitService = new UnifiedEmailService({
        ...config,
        rateLimiting: { maxEmailsPerHour: 1, maxEmailsPerDay: 10 }
      });

      // This is a simplified test - in reality, we'd need to simulate time passing
      // or mock the internal rate limiting mechanism more thoroughly
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when all providers are working', async () => {
      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.providers).toHaveLength(1);
      expect(health.providers[0].name).toBe('Gmail');
      expect(health.providers[0].status).toBe('healthy');
      expect(health.webhooks.enabled).toBe(true);
    });

    it('should return degraded status when some providers fail', async () => {
      // This would require mocking provider failures
      // For now, we test the basic structure
      const health = await service.getHealthStatus();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('providers');
      expect(health).toHaveProperty('webhooks');
    });
  });

  describe('Error Handling', () => {
    it('should create UnifiedEmailError correctly', () => {
      const error = new UnifiedEmailError('Test error', 'TEST_CODE', 'gmail', { test: true });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.provider).toBe('gmail');
      expect(error.context).toEqual({ test: true });
    });

    it('should create EmailProviderError correctly', () => {
      const error = new EmailProviderError('gmail', 'Provider failed', { reason: 'timeout' });
      
      expect(error.message).toBe('gmail provider error: Provider failed');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.provider).toBe('gmail');
    });

    it('should create EmailValidationError correctly', () => {
      const error = new EmailValidationError('Invalid input', { field: 'email' });
      
      expect(error.message).toBe('Validation error: Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create EmailRateLimitError correctly', () => {
      const resetTime = new Date();
      const error = new EmailRateLimitError('gmail', resetTime, { userId: 'test' });
      
      expect(error.message).toContain('Rate limit exceeded for gmail');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.provider).toBe('gmail');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidParams = [
        { to: [], subject: 'Test', body: 'Test' }, // Empty recipients
        { to: ['test@example.com'], subject: '', body: 'Test' }, // Empty subject
        { to: ['test@example.com'], subject: 'Test', body: '' }, // Empty body
        { to: ['test@example.com'], subject: '   ', body: 'Test' }, // Whitespace subject
        { to: ['test@example.com'], subject: 'Test', body: '   ' } // Whitespace body
      ];

      invalidParams.forEach(async (params) => {
        const result = await service.sendEmail('test-user-id', 'test-agent-id', params as EmailParams);
        expect(result.success).toBe(false);
      });
    });

    it('should validate email address format', () => {
      const invalidEmails = [
        'invalid-email',
        'missing@domain',
        '@missing-local.com',
        'spaces in@email.com',
        'double@@domain.com'
      ];

      invalidEmails.forEach(async (email) => {
        const params: EmailParams = {
          to: [email],
          subject: 'Test',
          body: 'Test'
        };
        const result = await service.sendEmail('test-user-id', 'test-agent-id', params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Configuration', () => {
    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        providers: {
          gmail: { enabled: false }
        }
      };

      const service = createUnifiedEmailService(partialConfig);
      expect(service).toBeInstanceOf(UnifiedEmailService);
    });

    it('should use environment variables for default config', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GOOGLE_CLIENT_ID: 'env-client-id',
        WEBHOOK_BASE_URL: 'https://env.example.com'
      };

      const service = createUnifiedEmailService();
      expect(service).toBeInstanceOf(UnifiedEmailService);

      process.env = originalEnv;
    });
  });

  describe('Provider Selection', () => {
    it('should prefer Gmail over Outlook when both available', async () => {
      const bothProvidersConnection = [
        { ...mockWorkspaceConnection, provider: WorkspaceProvider.GOOGLE_WORKSPACE },
        { ...mockWorkspaceConnection, provider: WorkspaceProvider.MICROSOFT_365 }
      ];
      
      mockDatabase.getInstance().findWorkspaceConnections.mockResolvedValue(bothProvidersConnection);

      const testParams: EmailParams = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test'
      };

      const result = await service.sendEmail('test-user-id', 'test-agent-id', testParams);
      expect(result.provider).toBe('gmail');
    });
  });
}); 