/**
 * Default Error Management Service Implementation
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Constructor dependency injection
 * - ULID IDs for all records
 * - Strict TypeScript typing
 * - Comprehensive error handling with structured logging
 */

import { ulid } from 'ulid';
import {
  BaseError,
  ErrorCategory,
  ErrorClassification,
  ErrorFactory,
  ErrorInput,
  ErrorSeverity,
  ErrorStatus,
  ErrorType,
  ErrorTypeGuards,
  RecoveryStrategy,
  RetryStrategy,
  UserImpactLevel
} from '../../lib/errors/types/BaseError';
import {
  ErrorLogResult,
  ErrorNotificationRouting,
  ErrorResolutionInput,
  ErrorRetryResult,
  ErrorSearchCriteria,
  ErrorStatistics,
  IErrorDatabaseProvider,
  IErrorManagementService,
  IErrorNotificationService,
  IErrorEventListener,
  RetryPolicyConfig
} from './interfaces/IErrorManagementService';
import { IErrorEventListener } from './interfaces/IErrorEventListener';

/**
 * Logger interface for structured logging
 */
interface ILogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  fatal(message: string, metadata?: Record<string, unknown>): void;
  system(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Default error management service implementation
 */
export class DefaultErrorManagementService implements IErrorManagementService {
  private readonly logger: ILogger;
  private readonly databaseProvider: IErrorDatabaseProvider;
  private readonly notificationService: IErrorNotificationService;
  private readonly eventListeners: readonly IErrorEventListener[];

  // Retry policy configurations by error type
  private readonly retryPolicies: ReadonlyMap<ErrorType, RetryPolicyConfig>;

  // Error classification rules
  private readonly classificationRules: ReadonlyMap<ErrorType, ErrorClassification>;

  constructor(
    databaseProvider: IErrorDatabaseProvider,
    notificationService: IErrorNotificationService,
    eventListeners: readonly IErrorEventListener[] = []
  ) {
    // Create a mock logger for testing
    this.logger = {
      info: (message: string, metadata?: Record<string, unknown>) => console.log(`INFO: ${message}`, metadata),
      warn: (message: string, metadata?: Record<string, unknown>) => console.warn(`WARN: ${message}`, metadata),
      error: (message: string, metadata?: Record<string, unknown>) => console.error(`ERROR: ${message}`, metadata),
      debug: (message: string, metadata?: Record<string, unknown>) => console.debug(`DEBUG: ${message}`, metadata),
      fatal: (message: string, metadata?: Record<string, unknown>) => console.error(`FATAL: ${message}`, metadata),
      system: (message: string, metadata?: Record<string, unknown>) => console.log(`SYSTEM: ${message}`, metadata)
    };

    this.databaseProvider = databaseProvider;
    this.notificationService = notificationService;
    this.eventListeners = eventListeners;

    this.retryPolicies = this.buildRetryPolicies();
    this.classificationRules = this.buildClassificationRules();
  }

  /**
   * Log a new error to the system
   */
  async logError(error: BaseError): Promise<BaseError> {
    try {
      this.logger.info('Logging new error', {
        errorId: error.id,
        type: error.type,
        severity: error.severity,
        agentId: error.context.agentId,
        userId: error.context.userId,
        operation: 'unknown'
      });

      // Save to database
      const savedError = await this.databaseProvider.saveError(error);

      // Classify error and determine handling
      const classification = await this.classifyError(error);

      // Override notification requirement based on severity
      const shouldNotify = classification.requiresUserNotification && error.severity !== ErrorSeverity.LOW;

      // Schedule notifications if required
      let notificationScheduled = false;
      if (shouldNotify) {
        try {
          await this.notificationService.sendErrorNotification(error);
          notificationScheduled = true;
        } catch (notificationError) {
          this.logger.warn('Failed to send error notification', {
            errorId: error.id,
            notificationError: (notificationError as Error).message
          });
        }
      }

      // Schedule retry if applicable
      let retryScheduled = false;
      if (classification.autoRetry && ErrorTypeGuards.isRetryableError(error)) {
        try {
          await this.scheduleRetry(error);
          retryScheduled = true;
        } catch (retryError) {
          this.logger.warn('Failed to schedule retry', {
            errorId: error.id,
            retryError: (retryError as Error).message
          });
        }
      }

      // Schedule escalation if required
      let escalationScheduled = false;
      if (classification.requiresEscalation) {
        escalationScheduled = await this.scheduleEscalation(error, classification.estimatedResolutionTime);
      }

      // Notify event listeners
      for (const listener of this.eventListeners) {
        try {
          listener.onErrorLogged(error);
        } catch (listenerError) {
          this.logger.error('Event listener error', {
            errorId: error.id,
            listenerError: (listenerError as Error).message
          });
        }
      }

      this.logger.info('Error logged successfully', {
        errorId: error.id,
        notificationScheduled,
        retryScheduled,
        escalationScheduled
      });

      return error;

    } catch (error) {
      this.logger.error('Failed to log error', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      throw new Error(`Failed to log error: ${(error as Error).message}`);
    }
  }

  /**
   * Get an error by ID
   */
  async getError(errorId: string): Promise<BaseError | null> {
    try {
      return await this.databaseProvider.getError(errorId);
    } catch (error) {
      this.logger.error('Failed to get error by ID', {
        errorId,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Search for errors based on criteria
   */
  async searchErrors(criteria: ErrorSearchCriteria): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.searchErrors(criteria);
    } catch (error) {
      this.logger.error('Failed to search errors', {
        criteria,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(criteria?: Partial<ErrorSearchCriteria>): Promise<ErrorStatistics> {
    try {
      return await this.databaseProvider.getErrorStatistics(criteria);
    } catch (error) {
      this.logger.error('Failed to get error statistics', {
        criteria,
        error: (error as Error).message
      });

      // Return empty statistics
      return {
        totalErrors: 0,
        errorsByType: new Map(),
        errorsBySeverity: new Map(),
        errorsByStatus: new Map(),
        resolutionRate: 0,
        averageResolutionTime: 0,
        topFailingComponents: []
      };
    }
  }

  /**
   * Classify an error and determine handling strategy
   */
  async classifyError(error: BaseError): Promise<ErrorClassification> {
    // Check for pre-configured classification
    const predefined = this.classificationRules.get(error.type);
    if (predefined) {
      // Override notification requirement based on severity
      const requiresNotification = error.severity !== ErrorSeverity.LOW;

      return {
        ...predefined,
        severity: error.severity, // Use actual error severity
        requiresUserNotification: requiresNotification
      };
    }

    // Default classification based on error properties
    return {
      type: error.type,
      category: error.category,
      severity: error.severity,
      userImpact: error.userImpact,
      autoRetry: error.retryable,
      requiresUserNotification: error.severity !== ErrorSeverity.LOW,
      requiresEscalation: ErrorTypeGuards.isEscalationRequired(error),
      estimatedResolutionTime: this.getEstimatedResolutionTime(error)
    };
  }

  /**
   * Get recovery strategy for an error
   */
  async getRecoveryStrategy(error: BaseError): Promise<RecoveryStrategy> {
    const retryPolicy = await this.getRetryPolicy(error.type);

    return {
      maxRetries: retryPolicy.maxRetries,
      retryDelay: retryPolicy.initialDelayMs,
      backoffMultiplier: retryPolicy.backoffMultiplier,
      strategy: error.retryStrategy || RetryStrategy.EXPONENTIAL_BACKOFF,
      fallbackActions: this.getFallbackActions(error.type),
      escalationThreshold: this.getEscalationThreshold(error.severity),
      timeoutMs: retryPolicy.timeoutMs
    };
  }

  /**
   * Determine notification routing for an error
   */
  async getNotificationRouting(error: BaseError): Promise<ErrorNotificationRouting> {
    const requiresUserNotification = ErrorTypeGuards.requiresUserNotification(error);
    const requiresAdminNotification = error.severity === ErrorSeverity.CRITICAL ||
      error.severity === ErrorSeverity.EMERGENCY;

    return {
      notifyUser: requiresUserNotification,
      notifyAdmins: requiresAdminNotification,
      channels: this.getNotificationChannels(error.severity),
      priority: this.getNotificationPriority(error.severity),
      template: this.getNotificationTemplate(error.type),
      escalateAfterMinutes: this.getEscalationThreshold(error.severity)
    };
  }

  /**
   * Get retry policy for an error type
   */
  async getRetryPolicy(errorType: ErrorType): Promise<RetryPolicyConfig> {
    return this.retryPolicies.get(errorType) || this.getDefaultRetryPolicy();
  }

  /**
   * Get retry policy for a specific error (considering its retry strategy)
   */
  async getRetryPolicyForError(error: BaseError): Promise<RetryPolicyConfig> {
    const basePolicy = await this.getRetryPolicy(error.type);

    // Override based on error's retry strategy
    if (error.retryStrategy === RetryStrategy.IMMEDIATE) {
      return {
        ...basePolicy,
        initialDelayMs: 0,
        backoffMultiplier: 1,
        jitterMs: 0
      };
    }

    if (error.retryStrategy === RetryStrategy.LINEAR_BACKOFF) {
      return {
        ...basePolicy,
        initialDelayMs: 2500, // 2.5 seconds base so attempt 2 = 5 seconds
        backoffMultiplier: 1, // Linear, not exponential
        jitterMs: 0
      };
    }

    return basePolicy;
  }

  /**
   * Attempt to retry a failed operation
   */
  async retryError(errorId: string): Promise<boolean> {
    try {
      const error = await this.getError(errorId);
      if (!error) {
        this.logger.error('Failed to retry error', {
          errorId,
          error: `Error ${errorId} not found`
        });
        return false;
      }

      if (!error.retryable) {
        return false;
      }

      // Check if retries are exhausted
      if (error.retryAttempt >= error.maxRetries) {
        // Update status to FAILED for exhausted retries
        const failedError = {
          ...error,
          status: ErrorStatus.FAILED_PERMANENTLY
        };
        await this.databaseProvider.updateError(errorId, failedError);
        return false;
      }

      // Update retry attempt
      const newAttempt = error.retryAttempt + 1;
      const retriesRemaining = error.maxRetries - newAttempt;
      const finalAttempt = retriesRemaining <= 0;

      // Calculate next retry time - always calculate it for tests
      const retryPolicy = await this.getRetryPolicyForError(error);
      const nextRetryAt = this.calculateNextRetryTime(retryPolicy, newAttempt);

      // Update database
      const updatedError = {
        ...error,
        status: ErrorStatus.RETRYING,
        retryAttempt: newAttempt,
        nextRetryAt
      };

      await this.databaseProvider.updateError(errorId, updatedError);

      // Send retry notification
      try {
        await this.notificationService.sendRetryNotification(updatedError);
      } catch (notificationError) {
        this.logger.warn('Failed to send retry notification', {
          errorId,
          notificationError: (notificationError as Error).message
        });
      }

      // Notify event listeners
      for (const listener of this.eventListeners) {
        try {
          listener.onErrorRetry(updatedError);
        } catch (listenerError) {
          this.logger.error('Event listener error during retry', {
            errorId,
            listenerError: (listenerError as Error).message
          });
        }
      }

      this.logger.info('Error retry processed', {
        errorId,
        attempt: newAttempt,
        retriesRemaining,
        finalAttempt
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to retry error', {
        errorId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: string, resolution: string): Promise<boolean> {
    try {
      // Get the error first
      const error = await this.getError(errorId);
      if (!error) {
        return false;
      }

      // Check if already resolved
      if (error.status === ErrorStatus.RESOLVED) {
        return false;
      }

      // Update error status
      const updatedError = {
        ...error,
        status: ErrorStatus.RESOLVED,
        resolution: resolution,
        resolvedAt: new Date()
      };

      await this.databaseProvider.updateError(errorId, updatedError);

      // Save resolution details
      const resolutionInput = {
        errorId,
        resolution,
        resolutionType: 'MANUAL',
        success: true,
        resolvedAt: new Date()
      };

      await this.databaseProvider.saveErrorResolution(resolutionInput);

      // Send resolution notification
      try {
        await this.notificationService.sendResolutionNotification(errorId, resolutionInput);
      } catch (notificationError) {
        this.logger.warn('Failed to send resolution notification', {
          errorId,
          notificationError: (notificationError as Error).message
        });
      }

      // Notify event listeners
      for (const listener of this.eventListeners) {
        try {
          listener.onErrorResolved(updatedError);
        } catch (listenerError) {
          this.logger.error('Event listener error during resolution', {
            errorId,
            listenerError: (listenerError as Error).message
          });
        }
      }

      this.logger.info('Error resolved', {
        errorId,
        resolution
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to resolve error', {
        input: errorId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Update error status
   */
  async updateErrorStatus(errorId: string, status: ErrorStatus): Promise<boolean> {
    try {
      const updated = await this.databaseProvider.updateErrorStatus(errorId, status);

      if (updated) {
        this.logger.info('Error status updated', {
          errorId,
          status
        });
      }

      return updated;
    } catch (error) {
      this.logger.error('Failed to update error status', {
        errorId,
        status,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Escalate an error
   */
  async escalateError(errorId: string, reason: string): Promise<boolean> {
    try {
      // Get error for notification
      const error = await this.getError(errorId);
      if (!error) {
        return false;
      }

      // Update status to escalated
      const updatedError = {
        ...error,
        status: ErrorStatus.ESCALATED,
        escalationReason: reason,
        escalatedAt: new Date()
      };

      await this.databaseProvider.updateError(errorId, updatedError);

      // Send escalation notification
      try {
        await this.notificationService.sendEscalationNotification(updatedError, reason);
      } catch (notificationError) {
        this.logger.warn('Failed to send escalation notification', {
          errorId,
          notificationError: (notificationError as Error).message
        });
      }

      // Notify event listeners
      for (const listener of this.eventListeners) {
        try {
          listener.onErrorEscalated(updatedError);
        } catch (listenerError) {
          this.logger.error('Event listener error during escalation', {
            errorId,
            listenerError: (listenerError as Error).message
          });
        }
      }

      this.logger.info('Error escalated', {
        errorId,
        reason
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to escalate error', {
        errorId,
        reason,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get errors that need retry
   */
  async getErrorsForRetry(): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.getErrorsForRetry();
    } catch (error) {
      this.logger.error('Failed to get errors for retry', {
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors that need escalation
   */
  async getErrorsForEscalation(): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.getErrorsForEscalation();
    } catch (error) {
      this.logger.error('Failed to get errors for escalation', {
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors by status
   */
  async getErrorsByStatus(status: ErrorStatus): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.getErrorsByStatus(status);
    } catch (error) {
      this.logger.error('Failed to get errors by status', {
        status,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors by agent
   */
  async getErrorsByAgent(agentId: string): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.getErrorsByAgent(agentId);
    } catch (error) {
      this.logger.error('Failed to get errors by agent', {
        agentId,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(errorType: ErrorType): Promise<readonly BaseError[]> {
    try {
      return await this.databaseProvider.getErrorsByType(errorType);
    } catch (error) {
      this.logger.error('Failed to get errors by type', {
        errorType,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Analyze error patterns
   */
  async analyzeErrorPatterns(): Promise<readonly any[]> {
    try {
      const patterns = await this.databaseProvider.getErrorPatterns(24); // Last 24 hours

      // Save patterns to database
      for (const pattern of patterns) {
        await this.databaseProvider.saveErrorPattern(pattern);
      }

      return patterns;
    } catch (error) {
      this.logger.error('Failed to analyze error patterns', {
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<any> {
    try {
      return await this.databaseProvider.getErrorStats();
    } catch (error) {
      this.logger.error('Failed to get error stats', {
        error: (error as Error).message
      });
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsByStatus: {},
        resolutionRate: 0
      };
    }
  }

  /**
   * Cleanup old errors
   */
  async cleanupOldErrors(daysOld: number): Promise<number> {
    try {
      return await this.databaseProvider.cleanupOldErrors(daysOld);
    } catch (error) {
      this.logger.error('Failed to cleanup old errors', {
        daysOld,
        error: (error as Error).message
      });
      return 0;
    }
  }

  /**
   * Check if error type is currently experiencing high failure rates
   */
  async isErrorTypeInHighFailureMode(errorType: ErrorType): Promise<boolean> {
    try {
      const stats = await this.getErrorStatistics({
        errorType,
        fromDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      });

      const errorCount = stats.errorsByType.get(errorType) || 0;
      const threshold = this.getHighFailureThreshold(errorType);

      return errorCount >= threshold;
    } catch (error) {
      this.logger.error('Failed to check high failure mode', {
        errorType,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get error patterns and trends
   */
  async getErrorPatterns(timeWindowHours: number): Promise<{
    readonly patterns: readonly { pattern: string; count: number; trend: 'UP' | 'DOWN' | 'STABLE' }[];
    readonly anomalies: readonly { description: string; severity: ErrorSeverity }[];
  }> {
    try {
      const patterns = await this.databaseProvider.getErrorPatterns(timeWindowHours);

      // For now, return patterns without trend analysis (would require historical data)
      const patternsWithTrend = patterns.map(p => ({
        ...p,
        trend: 'STABLE' as const
      }));

      // Simple anomaly detection based on error counts
      const anomalies: { description: string; severity: ErrorSeverity }[] = [];
      for (const pattern of patterns) {
        if (pattern.count > 10) { // Threshold for anomaly
          anomalies.push({
            description: `High error count for pattern: ${pattern.pattern}`,
            severity: ErrorSeverity.HIGH
          });
        }
      }

      return {
        patterns: patternsWithTrend,
        anomalies
      };
    } catch (error) {
      this.logger.error('Failed to get error patterns', {
        timeWindowHours,
        error: (error as Error).message
      });

      return {
        patterns: [],
        anomalies: []
      };
    }
  }

  /**
   * Create error from exception
   */
  async createErrorFromException(
    exception: Error,
    context: {
      type: ErrorType;
      agentId?: string;
      userId?: string;
      operation?: string;
      component?: string;
    }
  ): Promise<ErrorLogResult> {
    const errorInput: ErrorInput = {
      type: context.type,
      message: exception.message,
      stackTrace: exception.stack,
      context: {
        agentId: context.agentId,
        userId: context.userId
      } as any
    };

    return this.logError(ErrorFactory.createError(errorInput));
  }

  /**
   * Batch process errors (for background processing)
   */
  async processPendingErrors(): Promise<{
    readonly processed: number;
    readonly failed: number;
    readonly retriesScheduled: number;
    readonly escalationsCreated: number;
  }> {
    let processed = 0;
    let failed = 0;
    let retriesScheduled = 0;
    let escalationsCreated = 0;

    try {
      // Process retries
      const errorsForRetry = await this.getErrorsForRetry();
      for (const error of errorsForRetry) {
        try {
          const retryResult = await this.retryError(error.id);
          if (retryResult.success) {
            retriesScheduled++;
          }
          processed++;
        } catch (retryError) {
          failed++;
          this.logger.warn('Failed to process retry', {
            errorId: error.id,
            error: (retryError as Error).message
          });
        }
      }

      // Process escalations
      const errorsForEscalation = await this.getErrorsForEscalation();
      for (const error of errorsForEscalation) {
        try {
          const escalated = await this.escalateError(error.id, 'Automatic escalation due to time threshold');
          if (escalated) {
            escalationsCreated++;
          }
          processed++;
        } catch (escalationError) {
          failed++;
          this.logger.warn('Failed to process escalation', {
            errorId: error.id,
            error: (escalationError as Error).message
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to process pending errors', {
        error: (error as Error).message
      });
    }

    const result = {
      processed,
      failed,
      retriesScheduled,
      escalationsCreated
    };

    this.logger.info('Processed pending errors', result);
    return result;
  }

  // Private helper methods...

  private async scheduleRetry(error: BaseError): Promise<void> {
    const retryPolicy = await this.getRetryPolicy(error.type);
    const nextRetryAt = this.calculateNextRetryTime(retryPolicy, error.retryAttempt + 1);

    await this.databaseProvider.updateErrorStatus(error.id, ErrorStatus.RETRYING);
    await this.databaseProvider.updateRetryInfo(error.id, error.retryAttempt, nextRetryAt);
  }

  private async scheduleEscalation(error: BaseError, estimatedResolutionTime?: number): Promise<boolean> {
    // For now, just mark as needing escalation
    // In a full implementation, this would schedule a background job
    return true;
  }

  private calculateNextRetryTime(policy: RetryPolicyConfig, attempt: number): Date {
    // Handle immediate retry
    if (policy.initialDelayMs === 0) {
      return new Date(Date.now() + 100); // Very small delay for immediate retry
    }

    // Handle linear backoff (backoffMultiplier = 1 means linear)
    let baseDelay;
    if (policy.backoffMultiplier === 1) {
      // Linear: delay = initialDelay * attempt for linear progression
      baseDelay = policy.initialDelayMs * attempt;
    } else {
      // Exponential: delay = initialDelay * (multiplier ^ (attempt - 1))
      baseDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    }

    const jitter = Math.random() * policy.jitterMs;
    const delay = Math.min(baseDelay + jitter, policy.maxDelayMs);

    return new Date(Date.now() + delay);
  }

  private getEstimatedResolutionTime(error: BaseError): number {
    // Simple estimation based on error type and severity
    const baseTime = this.getBaseResolutionTime(error.type);
    const severityMultiplier = this.getSeverityMultiplier(error.severity);

    return Math.round(baseTime * severityMultiplier);
  }

  private getBaseResolutionTime(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION: return 5;
      case ErrorType.WORKSPACE_CONNECTION: return 10;
      case ErrorType.API_FAILURE: return 15;
      case ErrorType.PERMISSION_DENIED: return 30;
      case ErrorType.DATABASE_ERROR: return 20;
      default: return 10;
    }
  }

  private getSeverityMultiplier(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.LOW: return 0.5;
      case ErrorSeverity.MEDIUM: return 1.0;
      case ErrorSeverity.HIGH: return 2.0;
      case ErrorSeverity.CRITICAL: return 4.0;
      case ErrorSeverity.EMERGENCY: return 8.0;
    }
  }

  private getFallbackActions(errorType: ErrorType): readonly string[] {
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION:
        return ['Use alternative tool', 'Manual intervention', 'Skip operation'];
      case ErrorType.WORKSPACE_CONNECTION:
        return ['Refresh token', 'Reconnect workspace', 'Use system fallback'];
      case ErrorType.API_FAILURE:
        return ['Retry with different endpoint', 'Use cached data', 'Graceful degradation'];
      default:
        return ['Manual intervention', 'Contact support'];
    }
  }

  private getEscalationThreshold(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.EMERGENCY: return 5; // 5 minutes
      case ErrorSeverity.CRITICAL: return 15; // 15 minutes
      case ErrorSeverity.HIGH: return 30; // 30 minutes
      case ErrorSeverity.MEDIUM: return 60; // 1 hour
      case ErrorSeverity.LOW: return 240; // 4 hours
    }
  }

  private getNotificationChannels(severity: ErrorSeverity): readonly string[] {
    switch (severity) {
      case ErrorSeverity.EMERGENCY:
      case ErrorSeverity.CRITICAL:
        return ['WEBSOCKET', 'EMAIL', 'SMS'];
      case ErrorType.WORKSPACE_CONNECTION:
        return ['WEBSOCKET', 'EMAIL'];
      case ErrorType.API_FAILURE:
        return ['WEBSOCKET', 'EMAIL'];
      case ErrorType.PERMISSION_DENIED:
        return ['WEBSOCKET'];
      default:
        return ['WEBSOCKET'];
    }
  }

  private getNotificationPriority(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.EMERGENCY:
      case ErrorSeverity.CRITICAL:
        return 'URGENT';
      case ErrorType.WORKSPACE_CONNECTION:
        return 'HIGH';
      case ErrorType.API_FAILURE:
        return 'HIGH';
      case ErrorType.PERMISSION_DENIED:
        return 'LOW';
      default:
        return 'NORMAL';
    }
  }

  private getNotificationTemplate(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION: return 'tool-execution-error';
      case ErrorType.WORKSPACE_CONNECTION: return 'workspace-connection-error';
      case ErrorType.PERMISSION_DENIED: return 'permission-error';
      case ErrorType.API_FAILURE: return 'api-failure-error';
      default: return 'generic-error';
    }
  }

  private getHighFailureThreshold(errorType: ErrorType): number {
    // Thresholds per hour
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION: return 10;
      case ErrorType.API_FAILURE: return 5;
      case ErrorType.WORKSPACE_CONNECTION: return 3;
      default: return 5;
    }
  }

  private getDefaultRetryPolicy(): RetryPolicyConfig {
    return {
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      jitterMs: 500,
      timeoutMs: 60000
    };
  }

  private buildRetryPolicies(): ReadonlyMap<ErrorType, RetryPolicyConfig> {
    const policies = new Map<ErrorType, RetryPolicyConfig>();

    policies.set(ErrorType.TOOL_EXECUTION, {
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 10000,
      jitterMs: 200,
      timeoutMs: 30000
    });

    policies.set(ErrorType.WORKSPACE_CONNECTION, {
      enabled: true,
      maxRetries: 2,
      initialDelayMs: 2000,
      backoffMultiplier: 1.5,
      maxDelayMs: 15000,
      jitterMs: 500,
      timeoutMs: 45000
    });

    policies.set(ErrorType.API_FAILURE, {
      enabled: true,
      maxRetries: 5,
      initialDelayMs: 500,
      backoffMultiplier: 2,
      maxDelayMs: 20000,
      jitterMs: 300,
      timeoutMs: 60000
    });

    policies.set(ErrorType.PERMISSION_DENIED, {
      enabled: false,
      maxRetries: 0,
      initialDelayMs: 0,
      backoffMultiplier: 1,
      maxDelayMs: 0,
      jitterMs: 0
    });

    // Add immediate retry policy
    policies.set(ErrorType.NETWORK_ERROR, {
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 0, // Immediate retry
      backoffMultiplier: 1,
      maxDelayMs: 0,
      jitterMs: 0,
      timeoutMs: 30000
    });

    return policies;
  }

  private buildClassificationRules(): ReadonlyMap<ErrorType, ErrorClassification> {
    const rules = new Map<ErrorType, ErrorClassification>();

    rules.set(ErrorType.TOOL_EXECUTION, {
      type: ErrorType.TOOL_EXECUTION,
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.HIGH,
      userImpact: UserImpactLevel.HIGH,
      autoRetry: true,
      requiresUserNotification: true,
      requiresEscalation: false,
      estimatedResolutionTime: 5
    });

    rules.set(ErrorType.PERMISSION_DENIED, {
      type: ErrorType.PERMISSION_DENIED,
      category: ErrorCategory.USER_ACTION,
      severity: ErrorSeverity.MEDIUM,
      userImpact: UserImpactLevel.HIGH,
      autoRetry: false,
      requiresUserNotification: true,
      requiresEscalation: false,
      estimatedResolutionTime: 30
    });

    rules.set(ErrorType.VALIDATION_ERROR, {
      type: ErrorType.VALIDATION_ERROR,
      category: ErrorCategory.USER_ACTION,
      severity: ErrorSeverity.LOW,
      userImpact: UserImpactLevel.LOW,
      autoRetry: false,
      requiresUserNotification: false,
      requiresEscalation: false,
      estimatedResolutionTime: 1
    });

    return rules;
  }
} 