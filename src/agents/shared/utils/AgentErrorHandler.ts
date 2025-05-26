/**
 * AgentErrorHandler.ts - Handles error management and recovery
 * 
 * This component is responsible for:
 * - Error classification and categorization
 * - Error recovery strategies
 * - Error reporting and logging
 * - Error prevention mechanisms
 */

import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories
 */
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  RESOURCE = 'resource',
  TIMEOUT = 'timeout',
  DEPENDENCY = 'dependency',
  UNKNOWN = 'unknown'
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  ABORT = 'abort',
  ESCALATE = 'escalate',
  IGNORE = 'ignore'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  id: string;
  timestamp: Date;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  source: string;
  context: Record<string, unknown>;
  stackTrace?: string;
  originalError?: Error;
  recoveryStrategy: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  resolved: boolean;
  resolutionTime?: Date;
}

/**
 * Error recovery result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  newError?: ErrorInfo;
  context: Record<string, unknown>;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  enableAutoRecovery: boolean;
  enableErrorReporting: boolean;
  enableErrorPrevention: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  escalationThreshold: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableStackTrace: boolean;
  enableContextCapture: boolean;
}

/**
 * Error pattern for prevention
 */
export interface ErrorPattern {
  id: string;
  name: string;
  pattern: RegExp | string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  preventionStrategy: string;
  enabled: boolean;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveredErrors: number;
  unrecoveredErrors: number;
  averageRecoveryTime: number;
  mostCommonErrors: Array<{ code: string; count: number }>;
}

/**
 * AgentErrorHandler class - Handles error management and recovery
 */
export class AgentErrorHandler {
  private logger: ReturnType<typeof createLogger>;
  private config: ErrorHandlerConfig;
  private errors: Map<string, ErrorInfo> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private statistics: ErrorStatistics;
  private recoveryStrategies: Map<string, (error: ErrorInfo) => Promise<RecoveryResult>> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.logger = createLogger({
      moduleId: 'agent-error-handler',
    });
    
    // Set default configuration
    this.config = {
      enableAutoRecovery: true,
      enableErrorReporting: true,
      enableErrorPrevention: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      escalationThreshold: 5,
      logLevel: 'error',
      enableStackTrace: true,
      enableContextCapture: true,
      ...config
    };

    // Initialize statistics
    this.statistics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoveredErrors: 0,
      unrecoveredErrors: 0,
      averageRecoveryTime: 0,
      mostCommonErrors: []
    };

    // Initialize error categories and severities in statistics
    Object.values(ErrorCategory).forEach(category => {
      this.statistics.errorsByCategory[category] = 0;
    });
    
    Object.values(ErrorSeverity).forEach(severity => {
      this.statistics.errorsBySeverity[severity] = 0;
    });

    // Initialize default recovery strategies and error patterns
    this.initializeDefaultRecoveryStrategies();
    this.initializeDefaultErrorPatterns();
  }

  /**
   * Handle an error with automatic classification and recovery
   */
  async handleError(
    error: Error | string,
    source: string,
    context: Record<string, unknown> = {}
  ): Promise<ErrorInfo> {
    try {
      // Create error info
      const errorInfo = this.createErrorInfo(error, source, context);
      
      // Store error
      this.errors.set(errorInfo.id, errorInfo);
      
      // Update statistics
      this.updateStatistics(errorInfo);
      
      // Log error
      this.logError(errorInfo);
      
      // Attempt recovery if enabled
      if (this.config.enableAutoRecovery) {
        await this.attemptRecovery(errorInfo);
      }
      
      // Report error if enabled
      if (this.config.enableErrorReporting) {
        await this.reportError(errorInfo);
      }
      
      return errorInfo;
      
    } catch (handlingError) {
      this.logger.error('Error occurred while handling error:', { error: handlingError instanceof Error ? handlingError.message : String(handlingError) });
      
      // Create minimal error info for the handling error
      const fallbackError: ErrorInfo = {
        id: `error_${Date.now()}`,
        timestamp: new Date(),
        message: `Error handling failed: ${(handlingError as Error).message}`,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.CRITICAL,
        code: 'ERROR_HANDLING_FAILED',
        source: 'AgentErrorHandler',
        context: { originalError: error, handlingError },
        recoveryStrategy: RecoveryStrategy.ESCALATE,
        retryCount: 0,
        maxRetries: 0,
        resolved: false
      };
      
      return fallbackError;
    }
  }

  /**
   * Create structured error information
   */
  private createErrorInfo(
    error: Error | string,
    source: string,
    context: Record<string, unknown>
  ): ErrorInfo {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const originalError = typeof error === 'string' ? undefined : error;
    
    // Classify error
    const classification = this.classifyError(errorMessage, originalError);
    
    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(classification.category, classification.severity);
    
    const errorInfo: ErrorInfo = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      message: errorMessage,
      category: classification.category,
      severity: classification.severity,
      code: classification.code,
      source,
      context: this.config.enableContextCapture ? { ...context } : {},
      stackTrace: this.config.enableStackTrace && originalError ? originalError.stack : undefined,
      originalError,
      recoveryStrategy,
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts,
      resolved: false
    };
    
    return errorInfo;
  }

  /**
   * Classify error by category, severity, and code
   */
  private classifyError(
    message: string,
    error?: Error
  ): { category: ErrorCategory; severity: ErrorSeverity; code: string } {
    // Check against known error patterns
    const patterns = Array.from(this.errorPatterns.values());
    for (const pattern of patterns) {
      if (!pattern.enabled) continue;
      
      const regex = typeof pattern.pattern === 'string' 
        ? new RegExp(pattern.pattern, 'i') 
        : pattern.pattern;
      
      if (regex.test(message)) {
        return {
          category: pattern.category,
          severity: pattern.severity,
          code: pattern.id.toUpperCase()
        };
      }
    }
    
    // Fallback classification based on common patterns
    const lowerMessage = message.toLowerCase();
    
    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') || 
        lowerMessage.includes('timeout') || lowerMessage.includes('fetch')) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        code: 'NETWORK_ERROR'
      };
    }
    
    // Authentication errors
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('forbidden')) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        code: 'AUTH_ERROR'
      };
    }
    
    // Validation errors
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
        lowerMessage.includes('required')) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        code: 'VALIDATION_ERROR'
      };
    }
    
    // Configuration errors
    if (lowerMessage.includes('config') || lowerMessage.includes('setting') || 
        lowerMessage.includes('parameter')) {
      return {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.MEDIUM,
        code: 'CONFIG_ERROR'
      };
    }
    
    // Resource errors
    if (lowerMessage.includes('memory') || lowerMessage.includes('disk') || 
        lowerMessage.includes('resource') || lowerMessage.includes('limit')) {
      return {
        category: ErrorCategory.RESOURCE,
        severity: ErrorSeverity.HIGH,
        code: 'RESOURCE_ERROR'
      };
    }
    
    // Default classification
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Determine appropriate recovery strategy
   */
  private determineRecoveryStrategy(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): RecoveryStrategy {
    // Critical errors should be escalated
    if (severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.ESCALATE;
    }
    
    // Strategy based on category
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return RecoveryStrategy.RETRY;
        
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return RecoveryStrategy.ESCALATE;
        
      case ErrorCategory.VALIDATION:
        return RecoveryStrategy.SKIP;
        
      case ErrorCategory.CONFIGURATION:
        return RecoveryStrategy.FALLBACK;
        
      case ErrorCategory.RESOURCE:
        return severity === ErrorSeverity.HIGH 
          ? RecoveryStrategy.ESCALATE 
          : RecoveryStrategy.RETRY;
        
      case ErrorCategory.PROCESSING:
        return RecoveryStrategy.RETRY;
        
      case ErrorCategory.DEPENDENCY:
        return RecoveryStrategy.FALLBACK;
        
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(errorInfo: ErrorInfo): Promise<void> {
    try {
      this.logger.info(`Attempting recovery for error ${errorInfo.id} using strategy: ${errorInfo.recoveryStrategy}`);
      
      const strategy = this.recoveryStrategies.get(errorInfo.recoveryStrategy);
      if (!strategy) {
        this.logger.warn(`No recovery strategy found for: ${errorInfo.recoveryStrategy}`);
        return;
      }
      
      const result = await strategy(errorInfo);
      
      if (result.success) {
        errorInfo.resolved = true;
        errorInfo.resolutionTime = new Date();
        this.statistics.recoveredErrors++;
        
        this.logger.info(`Successfully recovered from error ${errorInfo.id}: ${result.message}`);
      } else {
        this.statistics.unrecoveredErrors++;
        
        if (result.newError) {
          // Handle the new error that occurred during recovery
          await this.handleError(result.newError.message, errorInfo.source, result.context);
        }
        
        this.logger.warn(`Failed to recover from error ${errorInfo.id}: ${result.message}`);
      }
      
    } catch (recoveryError) {
      this.logger.error(`Recovery attempt failed for error ${errorInfo.id}:`, { error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError) });
      this.statistics.unrecoveredErrors++;
    }
  }

  /**
   * Log error based on configuration
   */
  private logError(errorInfo: ErrorInfo): void {
    const logMessage = `[${errorInfo.category}] ${errorInfo.message}`;
    const logContext = {
      errorId: errorInfo.id,
      code: errorInfo.code,
      source: errorInfo.source,
      severity: errorInfo.severity,
      context: errorInfo.context
    };
    
    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(logMessage, logContext);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage, logContext);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(logMessage, logContext);
        break;
    }
  }

  /**
   * Report error to external systems
   */
  private async reportError(errorInfo: ErrorInfo): Promise<void> {
    try {
      // This would integrate with external error reporting services
      // For now, we'll just log the reporting action
      
      if (errorInfo.severity === ErrorSeverity.CRITICAL || errorInfo.severity === ErrorSeverity.HIGH) {
        this.logger.info(`Reporting error ${errorInfo.id} to external monitoring systems`);
        
        // Simulate external reporting
        // await externalErrorReporter.report(errorInfo);
      }
      
    } catch (reportingError) {
      this.logger.warn(`Failed to report error ${errorInfo.id}:`, { error: reportingError instanceof Error ? reportingError.message : String(reportingError) });
    }
  }

  /**
   * Update error statistics
   */
  private updateStatistics(errorInfo: ErrorInfo): void {
    this.statistics.totalErrors++;
    this.statistics.errorsByCategory[errorInfo.category]++;
    this.statistics.errorsBySeverity[errorInfo.severity]++;
    
    // Update most common errors
    const existingError = this.statistics.mostCommonErrors.find(e => e.code === errorInfo.code);
    if (existingError) {
      existingError.count++;
    } else {
      this.statistics.mostCommonErrors.push({ code: errorInfo.code, count: 1 });
    }
    
    // Sort and limit most common errors
    this.statistics.mostCommonErrors.sort((a, b) => b.count - a.count);
    this.statistics.mostCommonErrors = this.statistics.mostCommonErrors.slice(0, 10);
    
    // Update average recovery time
    const resolvedErrors = Array.from(this.errors.values()).filter(e => e.resolved && e.resolutionTime);
    if (resolvedErrors.length > 0) {
      const totalRecoveryTime = resolvedErrors.reduce((sum, error) => {
        const recoveryTime = error.resolutionTime!.getTime() - error.timestamp.getTime();
        return sum + recoveryTime;
      }, 0);
      
      this.statistics.averageRecoveryTime = totalRecoveryTime / resolvedErrors.length;
    }
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultRecoveryStrategies(): void {
    // Retry strategy
    this.addRecoveryStrategy(RecoveryStrategy.RETRY, async (errorInfo: ErrorInfo) => {
      if (errorInfo.retryCount >= errorInfo.maxRetries) {
        return {
          success: false,
          strategy: RecoveryStrategy.RETRY,
          message: 'Maximum retry attempts exceeded',
          context: { retryCount: errorInfo.retryCount, maxRetries: errorInfo.maxRetries }
        };
      }
      
      // Increment retry count
      errorInfo.retryCount++;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * errorInfo.retryCount));
      
      return {
        success: true,
        strategy: RecoveryStrategy.RETRY,
        message: `Retry attempt ${errorInfo.retryCount} scheduled`,
        context: { retryCount: errorInfo.retryCount }
      };
    });

    // Fallback strategy
    this.addRecoveryStrategy(RecoveryStrategy.FALLBACK, async (errorInfo: ErrorInfo) => {
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        message: 'Fallback mechanism activated',
        context: { originalError: errorInfo.code }
      };
    });

    // Skip strategy
    this.addRecoveryStrategy(RecoveryStrategy.SKIP, async (errorInfo: ErrorInfo) => {
      return {
        success: true,
        strategy: RecoveryStrategy.SKIP,
        message: 'Error skipped, continuing with next operation',
        context: { skippedError: errorInfo.code }
      };
    });

    // Abort strategy
    this.addRecoveryStrategy(RecoveryStrategy.ABORT, async (errorInfo: ErrorInfo) => {
      return {
        success: false,
        strategy: RecoveryStrategy.ABORT,
        message: 'Operation aborted due to error',
        context: { abortReason: errorInfo.code }
      };
    });

    // Escalate strategy
    this.addRecoveryStrategy(RecoveryStrategy.ESCALATE, async (errorInfo: ErrorInfo) => {
      return {
        success: false,
        strategy: RecoveryStrategy.ESCALATE,
        message: 'Error escalated to higher level handler',
        context: { escalatedError: errorInfo.code, severity: errorInfo.severity }
      };
    });

    // Ignore strategy
    this.addRecoveryStrategy(RecoveryStrategy.IGNORE, async (errorInfo: ErrorInfo) => {
      return {
        success: true,
        strategy: RecoveryStrategy.IGNORE,
        message: 'Error ignored as per configuration',
        context: { ignoredError: errorInfo.code }
      };
    });
  }

  /**
   * Initialize default error patterns
   */
  private initializeDefaultErrorPatterns(): void {
    // Network timeout pattern
    this.addErrorPattern({
      id: 'network_timeout',
      name: 'Network Timeout',
      pattern: /timeout|timed out|connection timeout/i,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      preventionStrategy: 'Increase timeout values and implement retry logic',
      enabled: true
    });

    // Memory error pattern
    this.addErrorPattern({
      id: 'memory_error',
      name: 'Memory Error',
      pattern: /out of memory|memory limit|heap|stack overflow/i,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.HIGH,
      preventionStrategy: 'Optimize memory usage and implement garbage collection',
      enabled: true
    });

    // Authentication error pattern
    this.addErrorPattern({
      id: 'auth_error',
      name: 'Authentication Error',
      pattern: /unauthorized|authentication failed|invalid credentials/i,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      preventionStrategy: 'Implement proper authentication and token refresh',
      enabled: true
    });

    // Validation error pattern
    this.addErrorPattern({
      id: 'validation_error',
      name: 'Validation Error',
      pattern: /validation failed|invalid input|required field/i,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      preventionStrategy: 'Implement comprehensive input validation',
      enabled: true
    });
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(
    strategy: RecoveryStrategy,
    handler: (error: ErrorInfo) => Promise<RecoveryResult>
  ): void {
    this.recoveryStrategies.set(strategy, handler);
    this.logger.info(`Added recovery strategy: ${strategy}`);
  }

  /**
   * Add error pattern for classification
   */
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.set(pattern.id, pattern);
    this.logger.info(`Added error pattern: ${pattern.name}`);
  }

  /**
   * Remove error pattern
   */
  removeErrorPattern(id: string): boolean {
    const removed = this.errorPatterns.delete(id);
    if (removed) {
      this.logger.info(`Removed error pattern: ${id}`);
    }
    return removed;
  }

  /**
   * Get error by ID
   */
  getError(id: string): ErrorInfo | undefined {
    return this.errors.get(id);
  }

  /**
   * Get all errors
   */
  getAllErrors(): ErrorInfo[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorInfo[] {
    return Array.from(this.errors.values()).filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorInfo[] {
    return Array.from(this.errors.values()).filter(error => error.severity === severity);
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): ErrorInfo[] {
    return Array.from(this.errors.values()).filter(error => !error.resolved);
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    return { ...this.statistics };
  }

  /**
   * Clear resolved errors older than specified time
   */
  clearOldErrors(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = new Date(Date.now() - olderThanMs);
    let clearedCount = 0;
    
    const entries = Array.from(this.errors.entries());
    for (const [id, error] of entries) {
      if (error.resolved && error.timestamp < cutoffTime) {
        this.errors.delete(id);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      this.logger.info(`Cleared ${clearedCount} old resolved errors`);
    }
    
    return clearedCount;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Error handler configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Generate error report
   */
  generateReport(): string {
    const stats = this.getStatistics();
    const unresolved = this.getUnresolvedErrors();
    
    let report = 'Agent Error Handler Report\n';
    report += '='.repeat(30) + '\n\n';
    
    report += `Total Errors: ${stats.totalErrors}\n`;
    report += `Recovered: ${stats.recoveredErrors}\n`;
    report += `Unrecovered: ${stats.unrecoveredErrors}\n`;
    report += `Recovery Rate: ${stats.totalErrors > 0 ? ((stats.recoveredErrors / stats.totalErrors) * 100).toFixed(1) : 0}%\n`;
    report += `Average Recovery Time: ${stats.averageRecoveryTime.toFixed(0)}ms\n\n`;
    
    report += 'Errors by Category:\n';
    for (const [category, count] of Object.entries(stats.errorsByCategory)) {
      if (count > 0) {
        report += `  ${category}: ${count}\n`;
      }
    }
    
    report += '\nErrors by Severity:\n';
    for (const [severity, count] of Object.entries(stats.errorsBySeverity)) {
      if (count > 0) {
        report += `  ${severity}: ${count}\n`;
      }
    }
    
    if (stats.mostCommonErrors.length > 0) {
      report += '\nMost Common Errors:\n';
      for (const error of stats.mostCommonErrors.slice(0, 5)) {
        report += `  ${error.code}: ${error.count}\n`;
      }
    }
    
    if (unresolved.length > 0) {
      report += `\nUnresolved Errors (${unresolved.length}):\n`;
      for (const error of unresolved.slice(0, 10)) {
        report += `  [${error.severity}] ${error.code}: ${error.message}\n`;
      }
    }
    
    return report;
  }
} 