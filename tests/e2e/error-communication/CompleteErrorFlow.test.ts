/**
 * Complete Error Flow End-to-End Tests
 * 
 * Testing complete error flow from generation to resolution:
 * - Generate actual tool errors
 * - Verify error logging to database
 * - Verify user notifications appear
 * - Test error dashboard functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DefaultErrorManagementService } from '../../../src/services/errors/DefaultErrorManagementService';
import { PrismaDatabaseProvider } from '../../../src/services/database/PrismaDatabaseProvider';
import { DefaultErrorNotificationService } from '../../../src/services/errors/DefaultErrorNotificationService';
import { ErrorType, ErrorSeverity, ErrorFactory } from '../../../src/lib/errors/types/BaseError';
import { prisma } from '../../../src/lib/prisma';
import { logger } from '../../../src/lib/core/logger';
import { ulid } from 'ulid';

describe('Complete Error Flow E2E Tests', () => {
  let errorManagementService: DefaultErrorManagementService;
  let databaseProvider: PrismaDatabaseProvider;
  let notificationService: DefaultErrorNotificationService;

  beforeAll(async () => {
    // Initialize real services for E2E testing
    databaseProvider = new PrismaDatabaseProvider();
    notificationService = new DefaultErrorNotificationService(logger);
    errorManagementService = new DefaultErrorManagementService(
      databaseProvider,
      notificationService,
      []
    );
  });

  beforeEach(async () => {
    // Clear test data
    await prisma.errorLog.deleteMany({
      where: {
        agentId: { startsWith: 'test-' }
      }
    });
    await prisma.errorResolution.deleteMany();
    await prisma.errorNotificationLog.deleteMany();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.errorLog.deleteMany({
      where: {
        agentId: { startsWith: 'test-' }
      }
    });
    await prisma.errorResolution.deleteMany();
    await prisma.errorNotificationLog.deleteMany();
  });

  describe('Email Tool Error Complete Flow', () => {
    it('should handle complete email failure flow from error to resolution', async () => {
      // Step 1: Generate actual email tool error
      const emailError = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'SMTP authentication failed - credentials rejected',
        context: {
          agentId: 'test-aria',
          userId: 'test-user-123',
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

      // Step 2: Log error through error management service
      const loggedError = await errorManagementService.logError(emailError);

      // Verify error was logged with correct properties
      expect(loggedError.id).toBeDefined();
      expect(loggedError.type).toBe(ErrorType.EMAIL_SERVICE_ERROR);
      expect(loggedError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(loggedError.context.agentId).toBe('test-aria');
      expect(loggedError.context.operation).toBe('sendEmail');

      // Step 3: Verify error was persisted to database
      const dbError = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(dbError).toBeTruthy();
      expect(dbError!.errorType).toBe('EMAIL_SERVICE_ERROR');
      expect(dbError!.severity).toBe('CRITICAL');
      expect(dbError!.agentId).toBe('test-aria');
      expect(dbError!.userId).toBe('test-user-123');
      expect(dbError!.operation).toBe('sendEmail');
      expect(dbError!.userNotified).toBe(true);

      // Step 4: Verify notification was logged
      const notificationLogs = await prisma.errorNotificationLog.findMany({
        where: { errorLogId: loggedError.id }
      });

      expect(notificationLogs).toHaveLength(1);
      expect(notificationLogs[0].notificationType).toBe('ERROR_NOTIFICATION');
      expect(notificationLogs[0].recipientId).toBe('test-user-123');
      expect(notificationLogs[0].deliveryStatus).toBe('SENT');

      // Step 5: Test error retrieval and filtering
      const retrievedError = await errorManagementService.getError(loggedError.id);
      expect(retrievedError).toBeTruthy();
      expect(retrievedError!.id).toBe(loggedError.id);

      const errorsByAgent = await databaseProvider.getErrorsByAgent('test-aria');
      expect(errorsByAgent).toHaveLength(1);
      expect(errorsByAgent[0].id).toBe(loggedError.id);

      const errorsByType = await databaseProvider.getErrorsByType(ErrorType.EMAIL_SERVICE_ERROR);
      expect(errorsByType).toHaveLength(1);
      expect(errorsByType[0].id).toBe(loggedError.id);

      // Step 6: Test error resolution
      await errorManagementService.resolveError(loggedError.id, 'E2E test resolution - fixed SMTP credentials');

      const resolvedError = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(resolvedError!.status).toBe('RESOLVED');
      expect(resolvedError!.resolvedAt).toBeTruthy();
      expect(resolvedError!.resolutionNotes).toBe('E2E test resolution - fixed SMTP credentials');

      // Verify resolution was logged
      const resolutionLogs = await prisma.errorResolution.findMany({
        where: { errorLogId: loggedError.id }
      });

      expect(resolutionLogs).toHaveLength(1);
      expect(resolutionLogs[0].resolutionType).toBe('MANUAL_FIX');
      expect(resolutionLogs[0].description).toBe('E2E test resolution - fixed SMTP credentials');
    });
  });

  describe('API Connection Error with Retry Flow', () => {
    it('should handle API failure with complete retry mechanism', async () => {
      // Step 1: Generate API connection error
      const apiError = ErrorFactory.createError({
        type: ErrorType.API_CONNECTION_ERROR,
        message: 'Connection timeout to CoinGecko API',
        context: {
          agentId: 'test-market-analyst',
          userId: 'test-user-456',
          toolId: 'crypto-api-tool',
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

      // Step 2: Log error
      const loggedError = await errorManagementService.logError(apiError);

      expect(loggedError.retryable).toBe(true);
      expect(loggedError.retryAttempt).toBe(0);
      expect(loggedError.maxRetries).toBeGreaterThan(0);

      // Step 3: Test retry mechanism
      const retryResult1 = await errorManagementService.retryError(loggedError.id);
      expect(retryResult1).toBe(true);

      // Verify retry was tracked
      const retryError1 = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(retryError1!.status).toBe('RETRYING');
      expect(retryError1!.retryAttempt).toBe(1);
      expect(retryError1!.lastRetryAt).toBeTruthy();

      // Test multiple retries
      const retryResult2 = await errorManagementService.retryError(loggedError.id);
      expect(retryResult2).toBe(true);

      const retryError2 = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(retryError2!.retryAttempt).toBe(2);

      // Test retry limit
      const maxRetries = retryError2!.maxRetries;
      for (let i = retryError2!.retryAttempt; i < maxRetries; i++) {
        await errorManagementService.retryError(loggedError.id);
      }

      // Should not retry beyond max attempts
      const finalRetryResult = await errorManagementService.retryError(loggedError.id);
      expect(finalRetryResult).toBe(false);

      // Verify retry notifications were sent
      const retryNotifications = await prisma.errorNotificationLog.findMany({
        where: {
          errorLogId: loggedError.id,
          notificationType: 'RETRY_NOTIFICATION'
        }
      });

      expect(retryNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('Workspace Permission Error Flow', () => {
    it('should handle permission denied with proper classification', async () => {
      // Step 1: Generate workspace permission error
      const permissionError = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied to Google Drive - insufficient permissions',
        context: {
          agentId: 'test-workspace-manager',
          userId: 'test-user-123',
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

      // Step 2: Log error
      const loggedError = await errorManagementService.logError(permissionError);

      // Verify error classification
      expect(loggedError.type).toBe(ErrorType.PERMISSION_DENIED);
      expect(loggedError.severity).toBe(ErrorSeverity.HIGH);
      expect(loggedError.retryable).toBe(false); // Permission errors shouldn't auto-retry

      // Step 3: Verify database persistence
      const dbError = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(dbError!.errorType).toBe('PERMISSION_DENIED');
      expect(dbError!.userNotified).toBe(true);

      // Step 4: Verify notification was sent with actionable guidance
      const notificationLogs = await prisma.errorNotificationLog.findMany({
        where: { errorLogId: loggedError.id }
      });

      expect(notificationLogs).toHaveLength(1);
      expect(notificationLogs[0].notificationType).toBe('ERROR_NOTIFICATION');

      // Step 5: Test that retry is not allowed for permission errors
      const retryResult = await errorManagementService.retryError(loggedError.id);
      expect(retryResult).toBe(false);

      // Verify retry attempt was not incremented
      const unchangedError = await prisma.errorLog.findFirst({
        where: { id: loggedError.id }
      });

      expect(unchangedError!.retryAttempt).toBe(0);
      expect(unchangedError!.status).toBe('NEW'); // Should remain NEW, not RETRYING
    });
  });

  describe('Error Statistics and Analytics', () => {
    it('should provide accurate error statistics', async () => {
      // Step 1: Generate multiple errors of different types and severities
      const errors = [
        {
          type: ErrorType.EMAIL_SERVICE_ERROR,
          severity: ErrorSeverity.CRITICAL,
          agentId: 'test-aria'
        },
        {
          type: ErrorType.API_RATE_LIMIT,
          severity: ErrorSeverity.MEDIUM,
          agentId: 'test-market-analyst'
        },
        {
          type: ErrorType.DATABASE_ERROR,
          severity: ErrorSeverity.HIGH,
          agentId: 'test-data-manager'
        },
        {
          type: ErrorType.VALIDATION_ERROR,
          severity: ErrorSeverity.LOW,
          agentId: 'test-validator'
        },
        {
          type: ErrorType.EMAIL_SERVICE_ERROR,
          severity: ErrorSeverity.HIGH,
          agentId: 'test-aria'
        }
      ];

      const loggedErrors = [];
      for (const errorData of errors) {
        const error = ErrorFactory.createError({
          type: errorData.type,
          message: `Test ${errorData.type} error`,
          context: {
            agentId: errorData.agentId,
            userId: 'test-user-123',
            operation: 'testOperation'
          },
          severity: errorData.severity
        });

        const logged = await errorManagementService.logError(error);
        loggedErrors.push(logged);
      }

      // Step 2: Resolve some errors
      await errorManagementService.resolveError(loggedErrors[0].id, 'Test resolution 1');
      await errorManagementService.resolveError(loggedErrors[1].id, 'Test resolution 2');

      // Step 3: Get and verify statistics
      const stats = await databaseProvider.getErrorStats({});

      expect(stats.totalErrors).toBe(5);
      expect(stats.resolvedErrors).toBe(2);
      expect(stats.criticalErrors).toBe(1);

      // Verify error distribution by type
      expect(stats.errorsByType.get(ErrorType.EMAIL_SERVICE_ERROR)).toBe(2);
      expect(stats.errorsByType.get(ErrorType.API_RATE_LIMIT)).toBe(1);
      expect(stats.errorsByType.get(ErrorType.DATABASE_ERROR)).toBe(1);
      expect(stats.errorsByType.get(ErrorType.VALIDATION_ERROR)).toBe(1);

      // Verify error distribution by severity
      expect(stats.errorsBySeverity.get(ErrorSeverity.CRITICAL)).toBe(1);
      expect(stats.errorsBySeverity.get(ErrorSeverity.HIGH)).toBe(2);
      expect(stats.errorsBySeverity.get(ErrorSeverity.MEDIUM)).toBe(1);
      expect(stats.errorsBySeverity.get(ErrorSeverity.LOW)).toBe(1);

      // Verify resolution rate
      const expectedResolutionRate = (2 / 5) * 100; // 40%
      expect(stats.resolutionRate).toBe(expectedResolutionRate);
    });
  });

  describe('Error Pattern Detection', () => {
    it('should detect and save error patterns', async () => {
      // Step 1: Generate similar errors to establish a pattern
      const patternErrors = [];
      for (let i = 0; i < 3; i++) {
        const error = ErrorFactory.createError({
          type: ErrorType.API_CONNECTION_ERROR,
          message: 'Connection failed to external service',
          context: {
            agentId: 'test-pattern-agent',
            userId: 'test-user-123',
            operation: 'fetchData',
            metadata: {
              apiEndpoint: 'https://api.unreliable-service.com',
              attempt: i + 1
            }
          },
          severity: ErrorSeverity.MEDIUM
        });

        const logged = await errorManagementService.logError(error);
        patternErrors.push(logged);
      }

      // Step 2: Verify pattern detection
      const patterns = await databaseProvider.getErrorPatterns();

      // Should detect pattern for repeated API connection failures
      const apiPattern = patterns.find(p =>
        p.errorType === ErrorType.API_CONNECTION_ERROR &&
        p.agentId === 'test-pattern-agent'
      );

      expect(apiPattern).toBeTruthy();
      expect(apiPattern!.occurrenceCount).toBeGreaterThanOrEqual(3);
      expect(apiPattern!.pattern).toContain('api.unreliable-service.com');
    });
  });

  describe('Error Escalation Flow', () => {
    it('should escalate critical errors appropriately', async () => {
      // Step 1: Generate critical error
      const criticalError = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'Complete email system failure - multiple SMTP servers down',
        context: {
          agentId: 'test-aria',
          userId: 'test-user-123',
          operation: 'sendEmail',
          metadata: {
            primarySmtp: 'smtp.gmail.com',
            backupSmtp: 'smtp.outlook.com',
            errorCode: 'COMPLETE_FAILURE'
          }
        },
        severity: ErrorSeverity.CRITICAL,
        retryAttempt: 3,
        maxRetries: 3
      });

      // Step 2: Log critical error
      const loggedError = await errorManagementService.logError(criticalError);

      // Step 3: Verify escalation notification was triggered
      const escalationNotifications = await prisma.errorNotificationLog.findMany({
        where: {
          errorLogId: loggedError.id,
          notificationType: 'ESCALATION_NOTIFICATION'
        }
      });

      expect(escalationNotifications).toHaveLength(1);
      expect(escalationNotifications[0].deliveryStatus).toBe('SENT');
      expect(escalationNotifications[0].escalationLevel).toBe('CRITICAL');
    });
  });

  describe('API Integration Tests', () => {
    it('should handle error operations via API endpoints', async () => {
      // Step 1: Create test error in database
      const testError = await prisma.errorLog.create({
        data: {
          id: ulid(),
          errorType: 'TOOL_EXECUTION',
          severity: 'MEDIUM',
          status: 'NEW',
          agentId: 'test-api-agent',
          userId: 'test-user-123',
          operation: 'testTool',
          message: 'Test tool execution error for API',
          retryAttempt: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Step 2: Test error retrieval via API (simulate API call)
      const retrievedErrors = await databaseProvider.getErrorsByStatus('NEW');
      const apiTestError = retrievedErrors.find(e => e.id === testError.id);

      expect(apiTestError).toBeTruthy();
      expect(apiTestError!.errorType).toBe('TOOL_EXECUTION');

      // Step 3: Test error resolution via API (simulate API call)
      await databaseProvider.updateError(testError.id, {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: 'API test resolution'
      });

      const resolvedError = await prisma.errorLog.findFirst({
        where: { id: testError.id }
      });

      expect(resolvedError!.status).toBe('RESOLVED');
      expect(resolvedError!.resolutionNotes).toBe('API test resolution');

      // Step 4: Test statistics via API (simulate API call)
      const stats = await databaseProvider.getErrorStats({});
      expect(stats.totalErrors).toBeGreaterThan(0);
      expect(stats.resolvedErrors).toBeGreaterThan(0);
    });
  });

  describe('Performance and Cleanup', () => {
    it('should handle cleanup of old errors', async () => {
      // Step 1: Create old test errors
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const oldErrors = [];
      for (let i = 0; i < 5; i++) {
        const oldError = await prisma.errorLog.create({
          data: {
            id: ulid(),
            errorType: 'TOOL_EXECUTION',
            severity: 'LOW',
            status: 'RESOLVED',
            agentId: 'test-cleanup-agent',
            userId: 'test-user-123',
            operation: 'oldOperation',
            message: `Old test error ${i}`,
            createdAt: oldDate,
            updatedAt: oldDate,
            resolvedAt: oldDate
          }
        });
        oldErrors.push(oldError);
      }

      // Step 2: Test cleanup functionality
      const cleanupResult = await databaseProvider.cleanupOldErrors(30); // 30 days retention

      expect(cleanupResult.deletedCount).toBe(5);

      // Step 3: Verify old errors were removed
      const remainingOldErrors = await prisma.errorLog.findMany({
        where: {
          id: { in: oldErrors.map(e => e.id) }
        }
      });

      expect(remainingOldErrors).toHaveLength(0);
    });

    it('should handle high volume of concurrent errors', async () => {
      const startTime = Date.now();

      // Generate multiple errors concurrently
      const errorPromises = [];
      for (let i = 0; i < 20; i++) {
        const error = ErrorFactory.createError({
          type: ErrorType.TOOL_EXECUTION,
          message: `Concurrent test error ${i}`,
          context: {
            agentId: `test-concurrent-agent-${i}`,
            userId: 'test-user-123',
            operation: 'concurrentTest'
          },
          severity: ErrorSeverity.MEDIUM
        });

        errorPromises.push(errorManagementService.logError(error));
      }

      const results = await Promise.all(errorPromises);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all errors were logged
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.type).toBe(ErrorType.TOOL_EXECUTION);
      });

      // Verify all errors are in database
      const dbErrors = await prisma.errorLog.findMany({
        where: {
          agentId: { startsWith: 'test-concurrent-agent-' }
        }
      });

      expect(dbErrors).toHaveLength(20);
    });
  });
}); 