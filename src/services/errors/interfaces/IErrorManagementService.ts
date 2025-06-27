/**
 * Error Management Service Interface
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Interface-first design with dependency injection
 * - Strict TypeScript typing
 * - Pure functions where possible
 * - ULID IDs for all records
 */

import {
  BaseError,
  ErrorClassification,
  ErrorInput,
  ErrorSeverity,
  ErrorStatus,
  ErrorType,
  RecoveryStrategy
} from '../../../lib/errors/types/BaseError';

/**
 * Error logging result interface
 */
export interface ErrorLogResult {
  readonly errorId: string; // ULID
  readonly logged: boolean;
  readonly notificationScheduled: boolean;
  readonly retryScheduled: boolean;
  readonly escalationScheduled: boolean;
}

/**
 * Error retry result interface
 */
export interface ErrorRetryResult {
  readonly success: boolean;
  readonly retriesRemaining: number;
  readonly nextRetryAt?: Date;
  readonly escalated: boolean;
  readonly finalAttempt: boolean;
}

/**
 * Error resolution input interface
 */
export interface ErrorResolutionInput {
  readonly errorId: string;
  readonly resolutionType: string;
  readonly description: string;
  readonly actionsTaken?: readonly string[];
  readonly success: boolean;
  readonly resolvedBy?: string;
  readonly preventionNotes?: string;
}

/**
 * Error search criteria interface
 */
export interface ErrorSearchCriteria {
  readonly agentId?: string;
  readonly userId?: string;
  readonly errorType?: ErrorType;
  readonly severity?: ErrorSeverity;
  readonly status?: ErrorStatus;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Error statistics interface
 */
export interface ErrorStatistics {
  readonly totalErrors: number;
  readonly errorsByType: ReadonlyMap<ErrorType, number>;
  readonly errorsBySeverity: ReadonlyMap<ErrorSeverity, number>;
  readonly errorsByStatus: ReadonlyMap<ErrorStatus, number>;
  readonly resolutionRate: number;
  readonly averageResolutionTime: number; // minutes
  readonly topFailingComponents: readonly { component: string; count: number }[];
}

/**
 * Error notification routing interface
 */
export interface ErrorNotificationRouting {
  readonly notifyUser: boolean;
  readonly notifyAdmins: boolean;
  readonly channels: readonly string[]; // EMAIL, SMS, PUSH, WEBSOCKET
  readonly priority: string; // LOW, NORMAL, HIGH, URGENT
  readonly template: string;
  readonly escalateAfterMinutes?: number;
}

/**
 * Retry policy configuration interface
 */
export interface RetryPolicyConfig {
  readonly enabled: boolean;
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly jitterMs: number;
  readonly timeoutMs?: number;
}

/**
 * Main error management service interface
 */
export interface IErrorManagementService {
  /**
   * Log a new error to the system
   */
  logError(input: ErrorInput): Promise<ErrorLogResult>;

  /**
   * Get an error by ID
   */
  getError(errorId: string): Promise<BaseError | null>;

  /**
   * Search for errors based on criteria
   */
  searchErrors(criteria: ErrorSearchCriteria): Promise<readonly BaseError[]>;

  /**
   * Get error statistics
   */
  getErrorStatistics(criteria?: Partial<ErrorSearchCriteria>): Promise<ErrorStatistics>;

  /**
   * Classify an error and determine handling strategy
   */
  classifyError(error: BaseError): Promise<ErrorClassification>;

  /**
   * Get recovery strategy for an error
   */
  getRecoveryStrategy(error: BaseError): Promise<RecoveryStrategy>;

  /**
   * Determine notification routing for an error
   */
  getNotificationRouting(error: BaseError): Promise<ErrorNotificationRouting>;

  /**
   * Get retry policy for an error type
   */
  getRetryPolicy(errorType: ErrorType): Promise<RetryPolicyConfig>;

  /**
   * Attempt to retry a failed operation
   */
  retryError(errorId: string): Promise<ErrorRetryResult>;

  /**
   * Mark an error as resolved
   */
  resolveError(input: ErrorResolutionInput): Promise<boolean>;

  /**
   * Update error status
   */
  updateErrorStatus(errorId: string, status: ErrorStatus): Promise<boolean>;

  /**
   * Escalate an error
   */
  escalateError(errorId: string, reason: string): Promise<boolean>;

  /**
   * Get errors that need retry
   */
  getErrorsForRetry(): Promise<readonly BaseError[]>;

  /**
   * Get errors that need escalation
   */
  getErrorsForEscalation(): Promise<readonly BaseError[]>;

  /**
   * Check if error type is currently experiencing high failure rates
   */
  isErrorTypeInHighFailureMode(errorType: ErrorType): Promise<boolean>;

  /**
   * Get error patterns and trends
   */
  getErrorPatterns(timeWindowHours: number): Promise<{
    readonly patterns: readonly { pattern: string; count: number; trend: 'UP' | 'DOWN' | 'STABLE' }[];
    readonly anomalies: readonly { description: string; severity: ErrorSeverity }[];
  }>;

  /**
   * Create error from exception
   */
  createErrorFromException(
    exception: Error,
    context: {
      type: ErrorType;
      agentId?: string;
      userId?: string;
      operation?: string;
      component?: string;
    }
  ): Promise<ErrorLogResult>;

  /**
   * Batch process errors (for background processing)
   */
  processPendingErrors(): Promise<{
    readonly processed: number;
    readonly failed: number;
    readonly retriesScheduled: number;
    readonly escalationsCreated: number;
  }>;
}

/**
 * Error management service provider interface for dependency injection
 */
export interface IErrorManagementServiceProvider {
  getErrorManagementService(): IErrorManagementService;
}

/**
 * Error event listener interface for real-time notifications
 */
export interface IErrorEventListener {
  /**
   * Called when a new error is logged
   */
  onErrorLogged(error: BaseError): Promise<void>;

  /**
   * Called when an error is resolved
   */
  onErrorResolved(errorId: string, resolution: ErrorResolutionInput): Promise<void>;

  /**
   * Called when an error is escalated
   */
  onErrorEscalated(errorId: string, reason: string): Promise<void>;

  /**
   * Called when retry is attempted
   */
  onRetryAttempted(errorId: string, attempt: number, success: boolean): Promise<void>;
}

/**
 * Database provider interface for error management
 */
export interface IErrorDatabaseProvider {
  /**
   * Save error to database
   */
  saveError(error: BaseError): Promise<string>; // Returns error ID

  /**
   * Get error by ID
   */
  getErrorById(errorId: string): Promise<BaseError | null>;

  /**
   * Search errors with criteria
   */
  searchErrors(criteria: ErrorSearchCriteria): Promise<readonly BaseError[]>;

  /**
   * Update error status
   */
  updateErrorStatus(errorId: string, status: ErrorStatus, metadata?: Record<string, unknown>): Promise<boolean>;

  /**
   * Update error data
   */
  updateError(errorId: string, updates: Partial<BaseError>): Promise<boolean>;

  /**
   * Save error resolution
   */
  saveErrorResolution(resolution: ErrorResolutionInput): Promise<boolean>;

  /**
   * Get error statistics
   */
  getErrorStatistics(criteria?: Partial<ErrorSearchCriteria>): Promise<ErrorStatistics>;

  /**
   * Get errors for retry (status = RETRYING and nextRetryAt <= now)
   */
  getErrorsForRetry(): Promise<readonly BaseError[]>;

  /**
   * Get errors for escalation (based on time thresholds and severity)
   */
  getErrorsForEscalation(): Promise<readonly BaseError[]>;

  /**
   * Update retry information
   */
  updateRetryInfo(errorId: string, retryAttempt: number, nextRetryAt?: Date): Promise<boolean>;

  /**
   * Get error patterns for analysis
   */
  getErrorPatterns(timeWindowHours: number): Promise<readonly { pattern: string; count: number }[]>;

  /**
   * Get errors by status
   */
  getErrorsByStatus(status: ErrorStatus): Promise<readonly BaseError[]>;

  /**
   * Get errors by agent
   */
  getErrorsByAgent(agentId: string): Promise<readonly BaseError[]>;

  /**
   * Get errors by type
   */
  getErrorsByType(errorType: ErrorType): Promise<readonly BaseError[]>;

  /**
   * Save error pattern for analysis
   */
  saveErrorPattern(pattern: any): Promise<boolean>;

  /**
   * Get error statistics summary
   */
  getErrorStats(): Promise<any>;

  /**
   * Clean up old errors
   */
  cleanupOldErrors(daysOld: number): Promise<number>;
}

/**
 * Notification service interface for error communication
 */
export interface IErrorNotificationService {
  /**
   * Send error notification to user
   */
  sendUserNotification(error: BaseError, routing: ErrorNotificationRouting): Promise<boolean>;

  /**
   * Send retry progress notification
   */
  sendRetryNotification(error: BaseError, attempt: number, maxAttempts: number): Promise<boolean>;

  /**
   * Send escalation notification
   */
  sendEscalationNotification(error: BaseError, reason: string): Promise<boolean>;

  /**
   * Send resolution notification
   */
  sendResolutionNotification(errorId: string, resolution: ErrorResolutionInput): Promise<boolean>;
} 