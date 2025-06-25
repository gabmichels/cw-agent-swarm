/**
 * DefaultErrorManagementService Tests
 * 
 * Testing the core error management service functionality
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { DefaultErrorManagementService } from '../../../src/services/errors/DefaultErrorManagementService';
import {
  type IErrorDatabaseProvider,
  type IErrorNotificationService,
  type IErrorEventListener
} from '../../../src/services/errors/interfaces/IErrorManagementService';
import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  ErrorStatus,
  ErrorCategory,
  ErrorFactory,
  RetryStrategy
} from '../../../src/lib/errors/types/BaseError';

// Mock dependencies
const mockDatabaseProvider: IErrorDatabaseProvider = {
  saveError: vi.fn(),
  updateError: vi.fn(),
  getError: vi.fn(),
  getErrorsByStatus: vi.fn(),
  getErrorsByAgent: vi.fn(),
  getErrorsByType: vi.fn(),
  getErrorPatterns: vi.fn(),
  saveErrorPattern: vi.fn(),
  saveErrorResolution: vi.fn(),
  getErrorResolutions: vi.fn(),
  logErrorNotification: vi.fn(),
  getErrorStats: vi.fn(),
  cleanupOldErrors: vi.fn()
};

const mockNotificationService: IErrorNotificationService = {
  sendErrorNotification: vi.fn(),
  sendRetryNotification: vi.fn(),
  sendEscalationNotification: vi.fn(),
  sendResolutionNotification: vi.fn()
};

const mockEventListener: IErrorEventListener = {
  onErrorLogged: vi.fn(),
  onErrorRetry: vi.fn(),
  onErrorResolved: vi.fn(),
  onErrorEscalated: vi.fn()
};

describe('DefaultErrorManagementService', () => {
  let service: DefaultErrorManagementService;
  let testError: BaseError;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create service instance
    service = new DefaultErrorManagementService(
      mockDatabaseProvider,
      mockNotificationService,
      [mockEventListener]
    );

    // Create test error
    testError = ErrorFactory.createError({
      type: ErrorType.TOOL_EXECUTION,
      message: 'Test tool execution failed',
      context: {
        agentId: 'agent-123',
        userId: 'user-456',
        toolId: 'tool-789',
        toolName: 'email_sender'
      }
    });
  });

  describe('logError', () => {
    it('should log error with ULID generation', async () => {
      (mockDatabaseProvider.saveError as MockedFunction<any>).mockResolvedValue(testError);

      const result = await service.logError(testError);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(mockDatabaseProvider.saveError).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: ErrorType.TOOL_EXECUTION,
          message: 'Test tool execution failed'
        })
      );
      expect(mockEventListener.onErrorLogged).toHaveBeenCalledWith(result);
    });

    it('should classify error correctly', async () => {
      (mockDatabaseProvider.saveError as MockedFunction<any>).mockResolvedValue(testError);

      const result = await service.logError(testError);

      expect(result.category).toBe(ErrorCategory.INTERNAL);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.retryable).toBe(true);
    });

    it('should send notification for high severity errors', async () => {
      (mockDatabaseProvider.saveError as MockedFunction<any>).mockResolvedValue(testError);

      await service.logError(testError);

      expect(mockNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.TOOL_EXECUTION,
          severity: ErrorSeverity.HIGH
        })
      );
    });

    it('should not send notification for low severity errors', async () => {
      const lowSeverityError = {
        ...testError,
        severity: ErrorSeverity.LOW
      };
      (mockDatabaseProvider.saveError as MockedFunction<any>).mockResolvedValue(lowSeverityError);

      await service.logError(lowSeverityError);

      expect(mockNotificationService.sendErrorNotification).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      (mockDatabaseProvider.saveError as MockedFunction<any>).mockRejectedValue(dbError);

      await expect(service.logError(testError)).rejects.toThrow(
        'Failed to log error: Database connection failed'
      );
    });
  });

  describe('getError', () => {
    it('should retrieve error by ID', async () => {
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(testError);

      const result = await service.getError(testError.id);

      expect(result).toEqual(testError);
      expect(mockDatabaseProvider.getError).toHaveBeenCalledWith(testError.id);
    });

    it('should return null for non-existent error', async () => {
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(null);

      const result = await service.getError('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('retryError', () => {
    it('should schedule retry for retryable error', async () => {
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(testError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue({
        ...testError,
        status: ErrorStatus.RETRYING,
        retryAttempt: 1
      });

      const result = await service.retryError(testError.id);

      expect(result).toBe(true);
      expect(mockDatabaseProvider.updateError).toHaveBeenCalledWith(
        testError.id,
        expect.objectContaining({
          status: ErrorStatus.RETRYING,
          retryAttempt: 1
        })
      );
      expect(mockEventListener.onErrorRetry).toHaveBeenCalled();
      expect(mockNotificationService.sendRetryNotification).toHaveBeenCalled();
    });

    it('should not retry non-retryable error', async () => {
      const nonRetryableError = {
        ...testError,
        retryable: false
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(nonRetryableError);

      const result = await service.retryError(testError.id);

      expect(result).toBe(false);
      expect(mockDatabaseProvider.updateError).not.toHaveBeenCalled();
    });

    it('should not retry error with exhausted retries', async () => {
      const exhaustedError = {
        ...testError,
        retryAttempt: 3,
        maxRetries: 3
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(exhaustedError);

      const result = await service.retryError(testError.id);

      expect(result).toBe(false);
      expect(mockDatabaseProvider.updateError).toHaveBeenCalledWith(
        testError.id,
        expect.objectContaining({
          status: ErrorStatus.FAILED_PERMANENTLY
        })
      );
    });

    it('should calculate retry delay with exponential backoff', async () => {
      const retryError = {
        ...testError,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        retryAttempt: 2
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(retryError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue({
        ...retryError,
        retryAttempt: 3
      });

      await service.retryError(testError.id);

      expect(mockDatabaseProvider.updateError).toHaveBeenCalledWith(
        testError.id,
        expect.objectContaining({
          nextRetryAt: expect.any(Date)
        })
      );
    });
  });

  describe('resolveError', () => {
    it('should resolve error successfully', async () => {
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(testError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue({
        ...testError,
        status: ErrorStatus.RESOLVED
      });

      const result = await service.resolveError(testError.id, 'Manual resolution');

      expect(result).toBe(true);
      expect(mockDatabaseProvider.updateError).toHaveBeenCalledWith(
        testError.id,
        expect.objectContaining({
          status: ErrorStatus.RESOLVED,
          resolvedAt: expect.any(Date)
        })
      );
      expect(mockDatabaseProvider.saveErrorResolution).toHaveBeenCalled();
      expect(mockEventListener.onErrorResolved).toHaveBeenCalled();
      expect(mockNotificationService.sendResolutionNotification).toHaveBeenCalled();
    });

    it('should not resolve already resolved error', async () => {
      const resolvedError = {
        ...testError,
        status: ErrorStatus.RESOLVED
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(resolvedError);

      const result = await service.resolveError(testError.id, 'Already resolved');

      expect(result).toBe(false);
      expect(mockDatabaseProvider.updateError).not.toHaveBeenCalled();
    });
  });

  describe('escalateError', () => {
    it('should escalate critical error', async () => {
      const criticalError = {
        ...testError,
        severity: ErrorSeverity.CRITICAL
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(criticalError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue({
        ...criticalError,
        status: ErrorStatus.ESCALATED
      });

      const result = await service.escalateError(testError.id, 'Critical system error');

      expect(result).toBe(true);
      expect(mockDatabaseProvider.updateError).toHaveBeenCalledWith(
        testError.id,
        expect.objectContaining({
          status: ErrorStatus.ESCALATED,
          escalatedAt: expect.any(Date)
        })
      );
      expect(mockEventListener.onErrorEscalated).toHaveBeenCalled();
      expect(mockNotificationService.sendEscalationNotification).toHaveBeenCalled();
    });
  });

  describe('getErrorsByStatus', () => {
    it('should retrieve errors by status', async () => {
      const errors = [testError];
      (mockDatabaseProvider.getErrorsByStatus as MockedFunction<any>).mockResolvedValue(errors);

      const result = await service.getErrorsByStatus(ErrorStatus.NEW);

      expect(result).toEqual(errors);
      expect(mockDatabaseProvider.getErrorsByStatus).toHaveBeenCalledWith(ErrorStatus.NEW);
    });
  });

  describe('getErrorsByAgent', () => {
    it('should retrieve errors by agent', async () => {
      const errors = [testError];
      (mockDatabaseProvider.getErrorsByAgent as MockedFunction<any>).mockResolvedValue(errors);

      const result = await service.getErrorsByAgent('agent-123');

      expect(result).toEqual(errors);
      expect(mockDatabaseProvider.getErrorsByAgent).toHaveBeenCalledWith('agent-123');
    });
  });

  describe('getErrorsByType', () => {
    it('should retrieve errors by type', async () => {
      const errors = [testError];
      (mockDatabaseProvider.getErrorsByType as MockedFunction<any>).mockResolvedValue(errors);

      const result = await service.getErrorsByType(ErrorType.TOOL_EXECUTION);

      expect(result).toEqual(errors);
      expect(mockDatabaseProvider.getErrorsByType).toHaveBeenCalledWith(ErrorType.TOOL_EXECUTION);
    });
  });

  describe('analyzeErrorPatterns', () => {
    it('should analyze and save error patterns', async () => {
      const patterns = [
        {
          id: 'pattern-1',
          type: ErrorType.TOOL_EXECUTION,
          frequency: 5,
          timeWindow: '1h',
          threshold: 3
        }
      ];
      (mockDatabaseProvider.getErrorPatterns as MockedFunction<any>).mockResolvedValue([]);
      (mockDatabaseProvider.saveErrorPattern as MockedFunction<any>).mockResolvedValue(patterns[0]);

      const result = await service.analyzeErrorPatterns();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getErrorStats', () => {
    it('should retrieve error statistics', async () => {
      const stats = {
        totalErrors: 100,
        errorsByType: { [ErrorType.TOOL_EXECUTION]: 50 },
        errorsBySeverity: { [ErrorSeverity.HIGH]: 30 },
        errorsByStatus: { [ErrorStatus.NEW]: 20 }
      };
      (mockDatabaseProvider.getErrorStats as MockedFunction<any>).mockResolvedValue(stats);

      const result = await service.getErrorStats();

      expect(result).toEqual(stats);
      expect(mockDatabaseProvider.getErrorStats).toHaveBeenCalled();
    });
  });

  describe('cleanupOldErrors', () => {
    it('should cleanup old resolved errors', async () => {
      (mockDatabaseProvider.cleanupOldErrors as MockedFunction<any>).mockResolvedValue(25);

      const result = await service.cleanupOldErrors(30);

      expect(result).toBe(25);
      expect(mockDatabaseProvider.cleanupOldErrors).toHaveBeenCalledWith(30);
    });
  });

  describe('Retry Policies', () => {
    it('should apply immediate retry strategy', async () => {
      const immediateRetryError = {
        ...testError,
        retryStrategy: RetryStrategy.IMMEDIATE
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(immediateRetryError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue(immediateRetryError);

      await service.retryError(testError.id);

      // For immediate retry, nextRetryAt should be approximately now
      const updateCall = (mockDatabaseProvider.updateError as MockedFunction<any>).mock.calls[0];
      const updatedError = updateCall[1];
      const now = new Date();
      const timeDiff = Math.abs(updatedError.nextRetryAt.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should apply linear backoff strategy', async () => {
      const linearRetryError = {
        ...testError,
        retryStrategy: RetryStrategy.LINEAR_BACKOFF,
        retryAttempt: 1
      };
      (mockDatabaseProvider.getError as MockedFunction<any>).mockResolvedValue(linearRetryError);
      (mockDatabaseProvider.updateError as MockedFunction<any>).mockResolvedValue(linearRetryError);

      await service.retryError(testError.id);

      const updateCall = (mockDatabaseProvider.updateError as MockedFunction<any>).mock.calls[0];
      const updatedError = updateCall[1];
      const delay = updatedError.nextRetryAt.getTime() - Date.now();
      expect(delay).toBeGreaterThan(4000); // 5 seconds * 1 attempt = 5 seconds
      expect(delay).toBeLessThan(6000);
    });
  });

  describe('Error Classification', () => {
    it('should classify different error types correctly', () => {
      const networkError = ErrorFactory.createError({
        type: ErrorType.NETWORK_ERROR,
        message: 'Network timeout',
        context: {}
      });

      const permissionError = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied',
        context: {}
      });

      const validationError = ErrorFactory.createError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Invalid input',
        context: {}
      });

      expect(networkError.category).toBe(ErrorCategory.EXTERNAL);
      expect(permissionError.category).toBe(ErrorCategory.USER_ACTION);
      expect(validationError.category).toBe(ErrorCategory.USER_ACTION);
    });
  });

  describe('Error Event Handling', () => {
    it('should notify all event listeners', async () => {
      const secondListener: IErrorEventListener = {
        onErrorLogged: vi.fn(),
        onErrorRetry: vi.fn(),
        onErrorResolved: vi.fn(),
        onErrorEscalated: vi.fn()
      };

      const serviceWithMultipleListeners = new DefaultErrorManagementService(
        mockDatabaseProvider,
        mockNotificationService,
        [mockEventListener, secondListener]
      );

      (mockDatabaseProvider.saveError as MockedFunction<any>).mockResolvedValue(testError);

      await serviceWithMultipleListeners.logError(testError);

      expect(mockEventListener.onErrorLogged).toHaveBeenCalledWith(testError);
      expect(secondListener.onErrorLogged).toHaveBeenCalledWith(testError);
    });
  });
}); 