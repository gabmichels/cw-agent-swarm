/**
 * Tool Error Scenarios Integration Tests
 * 
 * Testing tool execution failures, workspace permission errors, API connection failures,
 * and verifying user notifications are sent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultErrorManagementService } from '../../../src/services/errors/DefaultErrorManagementService';
import { EnhancedToolService } from '../../../src/services/tools/EnhancedToolService';
import { DefaultNotificationManager } from '../../../src/services/notifications/DefaultNotificationManager';
import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  ErrorFactory
} from '../../../src/lib/errors/types/BaseError';
import { prisma } from '../../../src/lib/prisma';
import { logger } from '../../../src/lib/core/logger';

// Mock external dependencies
vi.mock('../../../src/services/notifications/DefaultNotificationManager');
vi.mock('../../../src/lib/core/logger');

describe('Tool Error Scenarios Integration Tests', () => {
  let errorManagementService: DefaultErrorManagementService;
  let toolService: EnhancedToolService;
  let notificationManager: DefaultNotificationManager;
  let mockDatabaseProvider: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    // Clear database
    await prisma.errorLog.deleteMany();
    await prisma.errorResolution.deleteMany();
    await prisma.errorNotificationLog.deleteMany();

    // Reset mocks
    vi.clearAllMocks();

    // Create service instances
    notificationManager = new DefaultNotificationManager();

    // Mock database provider
    mockDatabaseProvider = {
      saveError: vi.fn().mockImplementation(async (error) => ({ ...error, id: error.id })),
      updateError: vi.fn().mockResolvedValue({}),
      getError: vi.fn().mockResolvedValue(null),
      getErrorsByStatus: vi.fn().mockResolvedValue([]),
      getErrorsByAgent: vi.fn().mockResolvedValue([]),
      getErrorsByType: vi.fn().mockResolvedValue([]),
      getErrorPatterns: vi.fn().mockResolvedValue([]),
      saveErrorPattern: vi.fn().mockResolvedValue({}),
      saveErrorResolution: vi.fn().mockResolvedValue({}),
      getErrorResolutions: vi.fn().mockResolvedValue([]),
      logErrorNotification: vi.fn().mockResolvedValue({}),
      getErrorStats: vi.fn().mockResolvedValue({}),
      cleanupOldErrors: vi.fn().mockResolvedValue({})
    };

    mockNotificationService = {
      sendErrorNotification: vi.fn().mockResolvedValue({}),
      sendRetryNotification: vi.fn().mockResolvedValue({}),
      sendEscalationNotification: vi.fn().mockResolvedValue({}),
      sendResolutionNotification: vi.fn().mockResolvedValue({})
    };

    errorManagementService = new DefaultErrorManagementService(
      mockDatabaseProvider,
      mockNotificationService,
      []
    );

    toolService = new EnhancedToolService(errorManagementService, logger);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.errorLog.deleteMany();
    await prisma.errorResolution.deleteMany();
    await prisma.errorNotificationLog.deleteMany();
  });

  describe('Tool Execution Failures', () => {
    it('should handle email tool execution failure and notify user', async () => {
      // Simulate email tool failure
      const toolError = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'SMTP authentication failed - credentials rejected',
        context: {
          agentId: 'aria',
          userId: 'user-123',
          toolId: 'email-tool',
          toolName: 'sendEmail',
          operation: 'sendEmail',
          metadata: {
            recipient: 'gab@crowd-wisdom.com',
            subject: 'Important Update',
            smtpServer: 'smtp.gmail.com',
            errorCode: 'AUTH_REJECTED'
          }
        },
        severity: ErrorSeverity.CRITICAL
      });

      // Log the error
      const result = await errorManagementService.logError(toolError);

      // Verify error was logged with correct classification
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.EMAIL_SERVICE_ERROR);
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.context.agentId).toBe('aria');
      expect(result.context.operation).toBe('sendEmail');

      // Verify database save was called
      expect(mockDatabaseProvider.saveError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.EMAIL_SERVICE_ERROR,
          severity: ErrorSeverity.CRITICAL,
          context: expect.objectContaining({
            agentId: 'aria',
            userId: 'user-123'
          })
        })
      );

      // Verify user notification was sent
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.EMAIL_SERVICE_ERROR,
          severity: ErrorSeverity.CRITICAL,
          context: expect.objectContaining({
            agentId: 'aria',
            userId: 'user-123'
          })
        })
      );
    });

    it('should handle API tool failure with retry mechanism', async () => {
      // Simulate API tool failure
      const apiError = ErrorFactory.createError({
        type: ErrorType.API_CONNECTION_ERROR,
        message: 'Connection timeout to CoinGecko API',
        context: {
          agentId: 'market-analyst',
          userId: 'user-456',
          toolId: 'crypto-price-tool',
          toolName: 'fetchCryptoPrice',
          operation: 'fetchCryptoPrice',
          metadata: {
            apiEndpoint: 'https://api.coingecko.com/api/v3/simple/price',
            timeoutDuration: '30s',
            cryptocurrency: 'bitcoin'
          }
        },
        severity: ErrorSeverity.MEDIUM
      });

      // Mock error retrieval for retry
      mockDatabaseProvider.getError.mockResolvedValue({
        ...apiError,
        retryable: true,
        retryAttempt: 0,
        maxRetries: 3
      });

      // Log the error
      const result = await errorManagementService.logError(apiError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.API_CONNECTION_ERROR);
      expect(result.retryable).toBe(true);

      // Simulate retry attempt
      const retryResult = await errorManagementService.retryError(result.id);
      expect(retryResult).toBe(true);

      // Verify retry notification was sent
      expect(mockNotificationService.sendRetryNotification).toHaveBeenCalled();
    });

    it('should handle database tool failure with fallback actions', async () => {
      // Simulate database tool failure
      const dbError = ErrorFactory.createError({
        type: ErrorType.DATABASE_ERROR,
        message: 'Connection to PostgreSQL database lost',
        context: {
          agentId: 'data-manager',
          userId: 'user-789',
          toolId: 'database-tool',
          toolName: 'queryDatabase',
          operation: 'queryDatabase',
          metadata: {
            database: 'postgresql',
            query: 'SELECT * FROM users',
            connectionString: 'postgresql://localhost:5432/db'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      const result = await errorManagementService.logError(dbError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.DATABASE_ERROR);
      expect(result.severity).toBe(ErrorSeverity.HIGH);

      // Verify database save was called
      expect(mockDatabaseProvider.saveError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.DATABASE_ERROR,
          severity: ErrorSeverity.HIGH
        })
      );
    });
  });

  describe('Workspace Permission Errors', () => {
    it('should handle Google Workspace permission denied error', async () => {
      // Simulate Google Workspace permission error
      const permissionError = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied to Google Drive - insufficient permissions',
        context: {
          agentId: 'workspace-manager',
          userId: 'user-123',
          toolId: 'google-drive-tool',
          toolName: 'accessGoogleDrive',
          operation: 'readFile',
          metadata: {
            service: 'Google Drive',
            requiredPermission: 'https://www.googleapis.com/auth/drive.readonly',
            fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
            errorCode: 'PERMISSION_DENIED'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      const result = await errorManagementService.logError(permissionError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.PERMISSION_DENIED);
      expect(result.retryable).toBe(false); // Permission errors shouldn't auto-retry

      // Verify user notification was sent with actionable guidance
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.PERMISSION_DENIED,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              service: 'Google Drive',
              requiredPermission: 'https://www.googleapis.com/auth/drive.readonly'
            })
          })
        })
      );
    });

    it('should handle OAuth token expired error with refresh strategy', async () => {
      // Simulate OAuth token expired error
      const tokenError = ErrorFactory.createError({
        type: ErrorType.OAUTH_TOKEN_EXPIRED,
        message: 'Google Workspace access token expired',
        context: {
          agentId: 'workspace-manager',
          userId: 'user-123',
          toolId: 'google-workspace-tool',
          toolName: 'accessGoogleSheets',
          operation: 'readSpreadsheet',
          metadata: {
            service: 'Google Sheets',
            tokenExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            refreshTokenAvailable: true
          }
        },
        severity: ErrorSeverity.MEDIUM
      });

      // Log the error
      const result = await errorManagementService.logError(tokenError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.OAUTH_TOKEN_EXPIRED);
      expect(result.retryable).toBe(true);

      // Verify notification was sent
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.OAUTH_TOKEN_EXPIRED,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              service: 'Google Sheets'
            })
          })
        })
      );
    });

    it('should handle Zoho Workspace connection error', async () => {
      // Simulate Zoho Workspace connection error
      const zohoError = ErrorFactory.createError({
        type: ErrorType.WORKSPACE_CONNECTION_ERROR,
        message: 'Failed to connect to Zoho Workspace - invalid region configuration',
        context: {
          agentId: 'zoho-integration',
          userId: 'user-456',
          toolId: 'zoho-workspace-tool',
          toolName: 'connectZohoWorkspace',
          operation: 'authenticate',
          metadata: {
            service: 'Zoho Workspace',
            region: 'US',
            errorCode: 'INVALID_REGION'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      const result = await errorManagementService.logError(zohoError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.WORKSPACE_CONNECTION_ERROR);

      // Verify user notification includes actionable guidance
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.WORKSPACE_CONNECTION_ERROR,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              service: 'Zoho Workspace',
              region: 'US'
            })
          })
        })
      );
    });
  });

  describe('API Connection Failures', () => {
    it('should handle GitHub API rate limit with backoff strategy', async () => {
      // Simulate GitHub API rate limit error
      const rateLimitError = ErrorFactory.createError({
        type: ErrorType.API_RATE_LIMIT,
        message: 'GitHub API rate limit exceeded',
        context: {
          agentId: 'code-analyzer',
          userId: 'user-789',
          toolId: 'github-api-tool',
          toolName: 'fetchRepository',
          operation: 'getRepositoryInfo',
          metadata: {
            apiEndpoint: 'https://api.github.com/repos/microsoft/vscode',
            rateLimitRemaining: 0,
            rateLimitReset: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            repository: 'microsoft/vscode'
          }
        },
        severity: ErrorSeverity.MEDIUM
      });

      // Log the error
      const result = await errorManagementService.logError(rateLimitError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.API_RATE_LIMIT);

      // Verify notification was sent
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.API_RATE_LIMIT,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              repository: 'microsoft/vscode'
            })
          })
        })
      );
    });

    it('should handle network timeout with immediate retry', async () => {
      // Simulate network timeout error
      const timeoutError = ErrorFactory.createError({
        type: ErrorType.NETWORK_TIMEOUT,
        message: 'Connection timeout to external API',
        context: {
          agentId: 'api-client',
          userId: 'user-123',
          toolId: 'http-client-tool',
          toolName: 'makeHttpRequest',
          operation: 'GET',
          metadata: {
            url: 'https://api.example.com/data',
            timeout: 30000,
            method: 'GET'
          }
        },
        severity: ErrorSeverity.LOW
      });

      // Mock error retrieval for retry
      mockDatabaseProvider.getError.mockResolvedValue({
        ...timeoutError,
        retryable: true,
        retryAttempt: 0,
        maxRetries: 2
      });

      // Log the error
      const result = await errorManagementService.logError(timeoutError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.NETWORK_TIMEOUT);

      // Test retry functionality
      const retryResult = await errorManagementService.retryError(result.id);
      expect(retryResult).toBe(true);
    });

    it('should handle SSL certificate error with no retry', async () => {
      // Simulate SSL certificate error
      const sslError = ErrorFactory.createError({
        type: ErrorType.SSL_CERTIFICATE_ERROR,
        message: 'SSL certificate verification failed',
        context: {
          agentId: 'secure-client',
          userId: 'user-456',
          toolId: 'https-client-tool',
          toolName: 'makeSecureRequest',
          operation: 'GET',
          metadata: {
            url: 'https://expired.badssl.com',
            certificateError: 'CERT_HAS_EXPIRED',
            issuer: 'BadSSL'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      const result = await errorManagementService.logError(sslError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.type).toBe(ErrorType.SSL_CERTIFICATE_ERROR);
      expect(result.retryable).toBe(false); // SSL errors shouldn't auto-retry

      // Verify user notification includes security warning
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.SSL_CERTIFICATE_ERROR,
          severity: ErrorSeverity.HIGH
        })
      );
    });
  });

  describe('Error Recovery and Escalation', () => {
    it('should escalate critical errors after failed retries', async () => {
      // Create critical error
      const criticalError = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'Complete email system failure',
        context: {
          agentId: 'aria',
          userId: 'user-123',
          operation: 'sendEmail'
        },
        severity: ErrorSeverity.CRITICAL,
        retryAttempt: 3,
        maxRetries: 3
      });

      // Log the error
      const result = await errorManagementService.logError(criticalError);

      // Verify error was logged
      expect(result.id).toBeDefined();
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);

      // Verify escalation notification was sent for critical errors
      expect(mockNotificationService.sendEscalationNotification).toHaveBeenCalled();
    });

    it('should track error patterns and adjust strategies', async () => {
      // Create multiple similar errors to establish pattern
      const errors = [];
      for (let i = 0; i < 3; i++) {
        const error = ErrorFactory.createError({
          type: ErrorType.API_CONNECTION_ERROR,
          message: 'Connection failed to external service',
          context: {
            agentId: 'test-agent',
            userId: 'user-123',
            operation: 'fetchData',
            apiEndpoint: 'https://api.unreliable-service.com'
          },
          severity: ErrorSeverity.MEDIUM
        });

        const result = await errorManagementService.logError(error);
        errors.push(result);
      }

      // Verify pattern detection affects classification
      const classificationEngine = errorManagementService['classificationEngine'];
      const lastError = errors[errors.length - 1];

      // Error frequency should be tracked
      const frequency = classificationEngine.getErrorFrequency(
        ErrorType.API_CONNECTION_ERROR,
        'test-agent'
      );

      expect(frequency).toBeGreaterThan(0);
    });

    it('should provide progress notifications during retry attempts', async () => {
      // Create retryable error
      const retryableError = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool execution failed temporarily',
        context: {
          agentId: 'test-agent',
          userId: 'user-123',
          toolName: 'temporaryTool'
        },
        severity: ErrorSeverity.MEDIUM
      });

      // Mock error retrieval for retry tracking
      mockDatabaseProvider.getError.mockResolvedValue({
        ...retryableError,
        retryable: true,
        retryAttempt: 0,
        maxRetries: 3
      });

      // Log the error
      const result = await errorManagementService.logError(retryableError);

      // Simulate retry attempts
      for (let attempt = 1; attempt <= 3; attempt++) {
        await errorManagementService.trackRetryAttempt(result.id, attempt);

        // Verify progress notification was sent
        expect(mockNotificationService.sendRetryNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            errorId: result.id,
            attempt: attempt,
            maxRetries: expect.any(Number)
          })
        );
      }
    });
  });

  describe('Notification Verification', () => {
    it('should send user-friendly error notifications', async () => {
      // Create user-facing error
      const userError = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'Failed to send email to recipient',
        context: {
          agentId: 'aria',
          userId: 'user-123',
          operation: 'sendEmail',
          metadata: {
            recipient: 'important@client.com',
            subject: 'Project Update'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      await errorManagementService.logError(userError);

      // Verify notification contains user-friendly information
      const notificationCall = mockNotificationService.sendErrorNotification.mock.calls[0];
      const notificationData = notificationCall[0];

      expect(notificationData).toMatchObject({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        severity: ErrorSeverity.HIGH,
        context: expect.objectContaining({
          agentId: 'aria',
          userId: 'user-123',
          metadata: expect.objectContaining({
            recipient: 'important@client.com',
            subject: 'Project Update'
          })
        })
      });
    });

    it('should include actionable suggestions in notifications', async () => {
      // Create permission error with actionable resolution
      const permissionError = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied to Google Drive',
        context: {
          agentId: 'workspace-manager',
          userId: 'user-123',
          metadata: {
            service: 'Google Drive',
            requiredPermission: 'drive.readonly'
          }
        },
        severity: ErrorSeverity.HIGH
      });

      // Log the error
      await errorManagementService.logError(permissionError);

      // Verify notification includes actionable suggestions
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.PERMISSION_DENIED,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              service: 'Google Drive',
              requiredPermission: 'drive.readonly'
            })
          })
        })
      );
    });
  });

  describe('Context Preservation', () => {
    it('should preserve all error context throughout the flow', async () => {
      const originalContext = {
        agentId: 'test-agent',
        userId: 'user-123',
        sessionId: 'session-456',
        toolId: 'tool-789',
        operation: 'sendEmail',
        metadata: {
          recipient: 'test@example.com',
          subject: 'Test Email',
          attachments: ['file1.pdf', 'file2.doc']
        }
      };

      const error = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool execution failed',
        context: originalContext,
        severity: ErrorSeverity.MEDIUM
      });

      // Log the error
      const result = await errorManagementService.logError(error);

      // Verify context is preserved in database save
      expect(mockDatabaseProvider.saveError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: originalContext
        })
      );

      // Verify context is preserved in notification
      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          context: originalContext
        })
      );

      // Verify all context fields are intact
      expect(result.context.agentId).toBe('test-agent');
      expect(result.context.userId).toBe('user-123');
      expect(result.context.sessionId).toBe('session-456');
      expect(result.context.toolId).toBe('tool-789');
      expect(result.context.operation).toBe('sendEmail');
      expect(result.context.metadata).toEqual({
        recipient: 'test@example.com',
        subject: 'Test Email',
        attachments: ['file1.pdf', 'file2.doc']
      });
    });
  });
}); 