/**
 * BaseError Type System Tests
 * 
 * Testing the error type hierarchy and factory methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  ErrorStatus,
  ErrorCategory,
  UserImpactLevel,
  RetryStrategy,
  ErrorFactory,
  ErrorTypeGuards,
  ErrorInput
} from '../../../src/lib/errors/types/BaseError';

describe('BaseError Type System', () => {
  describe('ErrorFactory', () => {
    it('should create error with ULID', () => {
      const input: ErrorInput = {
        type: ErrorType.TOOL_EXECUTION,
        message: 'Test error message',
        context: {
          agentId: 'agent-123',
          userId: 'user-456'
        }
      };

      const error = ErrorFactory.createError(input);

      expect(error.id).toBeDefined();
      expect(error.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(error.type).toBe(ErrorType.TOOL_EXECUTION);
      expect(error.message).toBe('Test error message');
      expect(error.context.agentId).toBe('agent-123');
      expect(error.context.userId).toBe('user-456');
      expect(error.status).toBe(ErrorStatus.NEW);
      expect(error.retryAttempt).toBe(0);
    });

    it('should categorize tool execution errors as INTERNAL', () => {
      const input: ErrorInput = {
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool failed',
        context: {}
      };

      const error = ErrorFactory.createError(input);

      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.userImpact).toBe(UserImpactLevel.HIGH);
      expect(error.retryable).toBe(true);
    });

    it('should categorize permission errors as USER_ACTION', () => {
      const input: ErrorInput = {
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied',
        context: {}
      };

      const error = ErrorFactory.createError(input);

      expect(error.category).toBe(ErrorCategory.USER_ACTION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.userImpact).toBe(UserImpactLevel.MEDIUM);
      expect(error.retryable).toBe(false);
    });

    it('should categorize API failures as EXTERNAL', () => {
      const input: ErrorInput = {
        type: ErrorType.API_FAILURE,
        message: 'API request failed',
        context: {}
      };

      const error = ErrorFactory.createError(input);

      expect(error.category).toBe(ErrorCategory.EXTERNAL);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(true);
    });

    it('should use custom severity when provided', () => {
      const input: ErrorInput = {
        type: ErrorType.TOOL_EXECUTION,
        message: 'Critical tool failure',
        context: {},
        severity: ErrorSeverity.CRITICAL,
        userImpact: UserImpactLevel.CRITICAL
      };

      const error = ErrorFactory.createError(input);

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.userImpact).toBe(UserImpactLevel.CRITICAL);
    });

    it('should set retry strategy and max retries', () => {
      const input: ErrorInput = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network timeout',
        context: {},
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 5
      };

      const error = ErrorFactory.createError(input);

      expect(error.retryStrategy).toBe(RetryStrategy.EXPONENTIAL_BACKOFF);
      expect(error.maxRetries).toBe(5);
    });

    it('should include metadata and stack trace', () => {
      const metadata = { requestId: 'req-123', timeout: 30000 };
      const input: ErrorInput = {
        type: ErrorType.API_FAILURE,
        message: 'Request timeout',
        context: {},
        metadata,
        stackTrace: 'Error: timeout\n  at fetch...'
      };

      const error = ErrorFactory.createError(input);

      expect(error.metadata).toEqual(metadata);
      expect(error.stackTrace).toBe('Error: timeout\n  at fetch...');
    });
  });

  describe('ErrorTypeGuards', () => {
    let retryableError: BaseError;
    let nonRetryableError: BaseError;
    let criticalError: BaseError;
    let oldError: BaseError;

    beforeEach(() => {
      retryableError = ErrorFactory.createError({
        type: ErrorType.NETWORK_ERROR,
        message: 'Network error',
        context: {},
        maxRetries: 3
      });

      nonRetryableError = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Permission denied',
        context: {},
        retryable: false,
        maxRetries: 0
      });

      criticalError = ErrorFactory.createError({
        type: ErrorType.DATABASE_ERROR,
        message: 'Database connection failed',
        context: {},
        severity: ErrorSeverity.CRITICAL
      });

      // Create an old error (more than 30 minutes ago)
      const oldTimestamp = new Date(Date.now() - 35 * 60 * 1000);
      oldError = {
        ...ErrorFactory.createError({
          type: ErrorType.API_FAILURE,
          message: 'Old error',
          context: {}
        }),
        timestamp: oldTimestamp
      };
    });

    it('should identify retryable errors', () => {
      expect(ErrorTypeGuards.isRetryableError(retryableError)).toBe(true);
      expect(ErrorTypeGuards.isRetryableError(nonRetryableError)).toBe(false);

      // Error with exhausted retries should not be retryable
      const exhaustedError = {
        ...retryableError,
        retryAttempt: 3 // equals maxRetries
      };
      expect(ErrorTypeGuards.isRetryableError(exhaustedError)).toBe(false);
    });

    it('should identify errors requiring escalation', () => {
      expect(ErrorTypeGuards.isEscalationRequired(criticalError)).toBe(true);
      expect(ErrorTypeGuards.isEscalationRequired(oldError)).toBe(true);
      expect(ErrorTypeGuards.isEscalationRequired(retryableError)).toBe(false);

      // Emergency errors should always require escalation
      const emergencyError = {
        ...retryableError,
        severity: ErrorSeverity.EMERGENCY
      };
      expect(ErrorTypeGuards.isEscalationRequired(emergencyError)).toBe(true);
    });

    it('should identify final statuses', () => {
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.RESOLVED)).toBe(true);
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.IGNORED)).toBe(true);
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.FAILED_PERMANENTLY)).toBe(true);
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.NEW)).toBe(false);
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.IN_PROGRESS)).toBe(false);
      expect(ErrorTypeGuards.isFinalStatus(ErrorStatus.RETRYING)).toBe(false);
    });

    it('should identify errors requiring user notification', () => {
      expect(ErrorTypeGuards.requiresUserNotification(criticalError)).toBe(true);

      // Network error has LOW severity by default, so shouldn't require notification
      expect(ErrorTypeGuards.requiresUserNotification(retryableError)).toBe(false);

      // Low severity errors should not require user notification
      const lowError = {
        ...retryableError,
        severity: ErrorSeverity.LOW
      };
      expect(ErrorTypeGuards.requiresUserNotification(lowError)).toBe(false);

      // Errors with no user impact should not require notification
      const noImpactError = {
        ...retryableError,
        userImpact: UserImpactLevel.NONE
      };
      expect(ErrorTypeGuards.requiresUserNotification(noImpactError)).toBe(false);

      // High severity errors should require notification
      const highSeverityError = {
        ...retryableError,
        severity: ErrorSeverity.HIGH
      };
      expect(ErrorTypeGuards.requiresUserNotification(highSeverityError)).toBe(true);
    });
  });

  describe('Error Creation', () => {
    it('should create error objects with correct structure', () => {
      const input: ErrorInput = {
        type: ErrorType.TOOL_EXECUTION,
        message: 'Test error',
        context: { agentId: 'agent-123' }
      };

      const error = ErrorFactory.createError(input);

      // Verify the error has all required properties
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ErrorType.TOOL_EXECUTION);
      expect(error.context.agentId).toBe('agent-123');
      expect(error.id).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.status).toBe(ErrorStatus.NEW);
      expect(error.retryAttempt).toBe(0);
    });
  });

  describe('Error Context', () => {
    it('should include timestamp automatically', () => {
      const beforeCreate = Date.now();

      const error = ErrorFactory.createError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Validation failed',
        context: {}
      });

      const afterCreate = Date.now();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(error.context.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(error.context.timestamp.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it('should preserve context data', () => {
      const context = {
        agentId: 'agent-456',
        userId: 'user-789',
        sessionId: 'session-abc',
        conversationId: 'conv-def',
        requestId: 'req-ghi',
        environment: 'test',
        serverInstance: 'server-1',
        version: '1.0.0'
      };

      const error = ErrorFactory.createError({
        type: ErrorType.EXTERNAL_SERVICE_ERROR,
        message: 'Service unavailable',
        context
      });

      expect(error.context.agentId).toBe('agent-456');
      expect(error.context.userId).toBe('user-789');
      expect(error.context.sessionId).toBe('session-abc');
      expect(error.context.conversationId).toBe('conv-def');
      expect(error.context.requestId).toBe('req-ghi');
      expect(error.context.environment).toBe('test');
      expect(error.context.serverInstance).toBe('server-1');
      expect(error.context.version).toBe('1.0.0');
    });
  });

  describe('Error Hierarchy', () => {
    it('should support parent-child error relationships', () => {
      const parentError = ErrorFactory.createError({
        type: ErrorType.WORKSPACE_CONNECTION,
        message: 'Connection failed',
        context: {}
      });

      const childError = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool failed due to connection',
        context: {},
        parentErrorId: parentError.id
      });

      expect(childError.parentErrorId).toBe(parentError.id);
      expect(childError.rootCauseErrorId).toBe(parentError.id);
    });
  });
}); 