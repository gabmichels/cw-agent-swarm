/**
 * ErrorClassificationEngine Tests
 * 
 * Testing error classification logic, pattern matching, and context analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultErrorClassificationEngine } from '../../../src/services/errors/ErrorClassificationEngine';
import {
  BaseError,
  ErrorType,
  ErrorSeverity,
  ErrorCategory,
  UserImpactLevel,
  RetryStrategy,
  ErrorFactory
} from '../../../src/lib/errors/types/BaseError';
import { type ILogger } from '../../../src/lib/core/logger';

// Mock logger
const mockLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  system: vi.fn()
};

describe('ErrorClassificationEngine', () => {
  let engine: DefaultErrorClassificationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DefaultErrorClassificationEngine(mockLogger);
  });

  describe('classifyError', () => {
    it('should classify tool execution errors correctly', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool execution failed: sendEmail',
        context: {
          agentId: 'agent-123',
          toolId: 'email-tool',
          toolName: 'sendEmail'
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.errorId).toBe(error.id);
      expect(classification.severity).toBeDefined();
      expect(classification.userImpact).toBeDefined();
      expect(classification.category).toBeDefined();
      expect(classification.retryable).toBeDefined();
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should classify email service errors as medium', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.EMAIL_SERVICE_ERROR,
        message: 'SMTP authentication failed',
        context: {
          agentId: 'aria',
          operation: 'sendEmail',
          recipient: 'user@example.com'
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.userImpact).toBe(UserImpactLevel.LOW);
      expect(classification.retryable).toBe(false);
    });

    it('should classify API rate limit errors with medium severity', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.API_RATE_LIMIT,
        message: 'Rate limit exceeded for CoinGecko API',
        context: {
          agentId: 'market-analyst',
          apiEndpoint: 'https://api.coingecko.com/api/v3/simple/price',
          rateLimitRemaining: 0
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.userImpact).toBe(UserImpactLevel.LOW);
      expect(classification.retryable).toBe(false);
    });

    it('should classify validation errors as low severity', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Invalid email format',
        context: {
          field: 'email',
          value: 'invalid-email'
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.severity).toBe(ErrorSeverity.LOW);
      expect(classification.userImpact).toBe(UserImpactLevel.LOW);
      expect(classification.retryable).toBe(false);
    });

    it('should detect known error patterns', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.OAUTH_TOKEN_EXPIRED,
        message: 'Google Workspace access token expired',
        context: {
          service: 'Google Drive',
          tokenExpiresAt: new Date().toISOString()
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.severity).toBeDefined();
      expect(classification.retryable).toBe(false);
      expect(classification.category).toBe(ErrorCategory.SYSTEM);
    });

    it('should handle unknown error types gracefully', async () => {
      const error = ErrorFactory.createError({
        type: 'UNKNOWN_ERROR_TYPE' as ErrorType,
        message: 'Something went wrong',
        context: {}
      });

      const classification = await engine.classifyError(error);

      expect(classification.severity).toBeDefined();
      expect(classification.category).toBeDefined();
      expect(classification.confidence).toBeGreaterThan(0);
    });
  });

  describe('analyzeContext', () => {
    it('should analyze context correctly', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: 'Tool failed',
        context: {
          agentId: 'aria',
          toolName: 'sendEmail'
        }
      });

      const contextAnalysis = await engine.analyzeContext(error);

      expect(contextAnalysis.agentLoad).toMatch(/^(low|medium|high)$/);
      expect(contextAnalysis.errorFrequency).toMatch(/^(rare|occasional|frequent)$/);
      expect(contextAnalysis.timeContext).toMatch(/^(business_hours|off_hours|weekend)$/);
      expect(contextAnalysis.userActivity).toMatch(/^(active|idle|unknown)$/);
      expect(contextAnalysis.systemHealth).toMatch(/^(healthy|degraded|critical)$/);
    });

    it('should consider time of day in classification', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.API_CONNECTION_ERROR,
        message: 'API connection failed',
        context: {
          agentId: 'test-agent',
          timestamp: new Date('2025-01-16T02:00:00Z').toISOString() // 2 AM UTC
        }
      });

      const contextAnalysis = await engine.analyzeContext(error);

      expect(contextAnalysis.timeContext).toBe('off_hours');
    });
  });

  describe('pattern management', () => {
    it('should register and retrieve patterns', async () => {
      const pattern = {
        id: 'test-pattern',
        name: 'Test Pattern',
        pattern: /test error/i,
        errorType: ErrorType.TOOL_EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        userImpact: UserImpactLevel.MEDIUM,
        category: ErrorCategory.INTERNAL,
        retryable: true,
        maxRetries: 3,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        actionable: true
      };

      await engine.registerPattern(pattern);

      const patterns = await engine.getKnownPatterns();
      expect(patterns.length).toBeGreaterThan(0);

      const registeredPattern = patterns.find(p => p.id === 'test-pattern');
      expect(registeredPattern).toBeDefined();
      expect(registeredPattern!.name).toBe('Test Pattern');
    });
  });

  describe('confidence scoring', () => {
    it('should provide confidence scores', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.API_RATE_LIMIT,
        message: 'Rate limit exceeded',
        context: {
          apiEndpoint: 'https://api.example.com'
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('actionable suggestions', () => {
    it('should provide actionable suggestions', async () => {
      const error = ErrorFactory.createError({
        type: ErrorType.PERMISSION_DENIED,
        message: 'Access denied to Google Drive',
        context: {
          service: 'Google Drive',
          requiredPermission: 'drive.readonly'
        }
      });

      const classification = await engine.classifyError(error);

      expect(classification.actionableSuggestions).toBeDefined();
      expect(Array.isArray(classification.actionableSuggestions)).toBe(true);
    });
  });
}); 